// Expenses module for Pay Period Allocator

// Store expenses data
let expenses = [];
let categories = [];

// Sorting state
let currentSortColumn = 'name';
let currentSortDirection = 'asc';

// Load expenses
async function loadExpenses() {
  console.log('Loading expenses...');
  
  // Load categories first
  await loadCategories();
  
  // Then load expenses with their splits
  const { data, error } = await window.supabase
    .from('expenses')
    .select(`
      *,
      expense_splits (*)
    `)
    .order('name');
  
  if (error) {
    console.error('Error loading expenses:', error);
    return;
  }
  
  expenses = data || [];
  
  // Also load pending split suggestions to show as unapproved expenses
  const currentUserId = getCurrentUser()?.id;
  if (currentUserId) {
    console.log('Loading pending split suggestions for user:', currentUserId);
    
    const { data: suggestions, error: suggestionsError } = await window.supabase
      .from('split_suggestions')
      .select(`
        id,
        expense_id,
        from_user_id,
        to_user_id,
        suggested_amount,
        suggested_ratio,
        status,
        expenses (
          *,
          expense_splits (*)
        ),
        profiles:from_user_id (
          name,
          email
        )
      `)
      .eq('to_user_id', currentUserId)
      .eq('status', 'pending');
    
    if (suggestionsError) {
      console.error('Error loading split suggestions:', suggestionsError);
    } else if (suggestions && suggestions.length > 0) {
      console.log('Found pending suggestions:', suggestions.length);
      
      // Add a flag to each suggestion's expense to mark it as a pending suggestion
      suggestions.forEach(suggestion => {
        if (suggestion.expenses) {
          console.log('Processing suggestion for expense:', suggestion.expenses.name);
          
          // Check if this expense is already in our expenses array
          const existingExpenseIndex = expenses.findIndex(e => e.id === suggestion.expenses.id);
          
          if (existingExpenseIndex >= 0) {
            // If it exists, just add the suggestion data to it
            console.log('Expense already exists, adding suggestion data');
            expenses[existingExpenseIndex].pendingSuggestion = suggestion;
          } else {
            // If it doesn't exist, add it to our expenses array with the suggestion flag
            console.log('Adding new expense from suggestion');
            const suggestionExpense = suggestion.expenses;
            suggestionExpense.pendingSuggestion = suggestion;
            expenses.push(suggestionExpense);
          }
        }
      });
    } else {
      console.log('No pending suggestions found');
    }
  }
  
  console.log('Rendering expenses...');
  await renderExpenses();
  
  // Update sort indicators
  updateSortIndicators();
  
  // Update dashboard
  updateDashboard();
  
  return expenses;
}

// Load categories
async function loadCategories() {
  const { data, error } = await window.supabase
    .from('categories')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error loading categories:', error);
    return;
  }
  
  categories = data || [];
  updateCategoryDropdown();
}

// Update category dropdown in expense form
function updateCategoryDropdown() {
  const categoryDropdown = document.getElementById('expense-category');
  if (!categoryDropdown) return;
  
  // Clear dropdown
  categoryDropdown.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a category';
  categoryDropdown.appendChild(defaultOption);
  
  // Add categories to dropdown
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    categoryDropdown.appendChild(option);
  });
}

// Render expenses table
async function renderExpenses() {
  const tableBody = document.getElementById('expenses-table-body');
  if (!tableBody) return;
  
  // Clear table
  tableBody.innerHTML = '';
  
  if (expenses.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="8" class="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm italic">
        No expenses found. Add an expense to get started.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  const currentUserId = getCurrentUser()?.id;
  
  // Create a map to store creator names
  const creatorNames = new Map();
  
  // First, fetch all creator names
  for (const expense of expenses) {
    if (expense.created_by_id && !creatorNames.has(expense.created_by_id)) {
      if (expense.created_by_id === currentUserId) {
        creatorNames.set(expense.created_by_id, 'You');
      } else {
        const creator = await findUserById(expense.created_by_id);
        if (creator) {
          creatorNames.set(expense.created_by_id, creator.name || creator.email || 'Unknown');
        } else {
          creatorNames.set(expense.created_by_id, 'Unknown');
        }
      }
    }
  }
  
  // Sort expenses based on current sort column and direction
  const sortedExpenses = [...expenses].sort((a, b) => {
    let valueA, valueB;
    
    // Determine values to compare based on sort column
    switch (currentSortColumn) {
      case 'name':
        valueA = a.name?.toLowerCase() || '';
        valueB = b.name?.toLowerCase() || '';
        break;
      case 'amount':
        // Convert amounts to the current display frequency for comparison
        valueA = convertAmount(a.raw_amount, a.raw_frequency, displayFrequency) * getSplitRatio(a);
        valueB = convertAmount(b.raw_amount, b.raw_frequency, displayFrequency) * getSplitRatio(b);
        break;
      case 'frequency':
        valueA = a.raw_frequency || '';
        valueB = b.raw_frequency || '';
        break;
      case 'account':
        const accountA = getAccountById(a.account_id);
        const accountB = getAccountById(b.account_id);
        valueA = accountA?.name?.toLowerCase() || '';
        valueB = accountB?.name?.toLowerCase() || '';
        break;
      case 'category':
        const categoryA = getCategoryById(a.category_id);
        const categoryB = getCategoryById(b.category_id);
        valueA = categoryA?.name?.toLowerCase() || '';
        valueB = categoryB?.name?.toLowerCase() || '';
        break;
      case 'split':
        valueA = getSplitRatio(a);
        valueB = getSplitRatio(b);
        break;
      case 'creator':
        valueA = creatorNames.get(a.created_by_id)?.toLowerCase() || '';
        valueB = creatorNames.get(b.created_by_id)?.toLowerCase() || '';
        break;
      default:
        valueA = a.name?.toLowerCase() || '';
        valueB = b.name?.toLowerCase() || '';
    }
    
    // Compare values based on sort direction
    if (currentSortDirection === 'asc') {
      return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    } else {
      return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
    }
  });
  
  // Add expenses to table
  sortedExpenses.forEach(expense => {
    // Check if this is a pending suggestion
    const isPendingSuggestion = expense.pendingSuggestion !== undefined;
    
    // Get account name
    const account = getAccountById(expense.account_id);
    const accountName = account ? account.name : 'None';
    
    // Get category name and create a styled tag
    const category = getCategoryById(expense.category_id);
    const categoryName = category ? category.name : 'Other';
    
    // Create category tag with appropriate color class
    const categoryTag = document.createElement('span');
    const categorySlug = categoryName.toLowerCase().replace(/\s+/g, '-');
    let categoryClass = 'category-tag-other'; // Default
    
    // Map category names to our predefined classes
    const categoryMap = {
      'housing': 'category-tag-housing',
      'rent': 'category-tag-housing',
      'mortgage': 'category-tag-housing',
      'food': 'category-tag-food',
      'groceries': 'category-tag-food',
      'dining': 'category-tag-food',
      'transportation': 'category-tag-transportation',
      'car': 'category-tag-transportation',
      'gas': 'category-tag-transportation',
      'utilities': 'category-tag-utilities',
      'electric': 'category-tag-utilities',
      'water': 'category-tag-utilities',
      'internet': 'category-tag-utilities',
      'entertainment': 'category-tag-entertainment',
      'streaming': 'category-tag-entertainment',
      'health': 'category-tag-health',
      'medical': 'category-tag-health',
      'insurance': 'category-tag-health'
    };
    
    // Find the appropriate category class
    for (const [key, value] of Object.entries(categoryMap)) {
      if (categorySlug.includes(key)) {
        categoryClass = value;
        break;
      }
    }
    
    categoryTag.className = `category-tag ${categoryClass}`;
    categoryTag.textContent = categoryName;
    
    // Get split ratio
    const splitRatio = isPendingSuggestion 
      ? expense.pendingSuggestion.suggested_ratio 
      : getSplitRatio(expense);
    
    // Check if this is a shared expense
    const isShared = expense.expense_splits && expense.expense_splits.length > 1;
    
    // Create split text with appropriate styling
    const splitElement = document.createElement('span');
    if (isPendingSuggestion) {
      splitElement.className = 'split-suggested';
      splitElement.innerHTML = `${formatPercentage(splitRatio)} <span class="text-amber-500 dark:text-amber-400 text-xs">(Suggested)</span>`;
    } else if (isShared) {
      splitElement.className = 'split-shared';
      splitElement.innerHTML = `${formatPercentage(splitRatio)} <span class="text-blue-500 dark:text-blue-400 text-xs">(Shared)</span>`;
    } else {
      splitElement.textContent = formatPercentage(splitRatio);
    }
    
    // Convert amount to display frequency
    const displayAmount = convertAmount(
      expense.raw_amount,
      expense.raw_frequency,
      displayFrequency
    );
    
    // Calculate user's share
    const userShare = isPendingSuggestion 
      ? expense.pendingSuggestion.suggested_amount 
      : (displayAmount * splitRatio);
    
    // Format the amount to show total and user's share if shared
    const amountElement = document.createElement('span');
    
    if (isPendingSuggestion) {
      // For pending suggestions, show a placeholder until approved
      amountElement.innerHTML = `${formatCurrency(userShare)} <span class="text-amber-500 dark:text-amber-400 text-xs">(Pending)</span>`;
    } else if (isShared) {
      amountElement.innerHTML = `<span class="${userShare < 0 ? 'amount-negative' : 'amount-positive'}">${formatCurrency(userShare)}</span> <span class="text-gray-500 dark:text-gray-400 text-xs">of ${formatCurrency(displayAmount)}</span>`;
    } else {
      amountElement.className = displayAmount < 0 ? 'amount-negative' : 'amount-positive';
      amountElement.textContent = formatCurrency(displayAmount);
    }
    
    // Get creator name from the map
    let creatorName = 'Unknown';
    if (expense.created_by_id && creatorNames.has(expense.created_by_id)) {
      creatorName = creatorNames.get(expense.created_by_id);
    } else if (isPendingSuggestion && expense.pendingSuggestion.profiles) {
      creatorName = expense.pendingSuggestion.profiles.name || expense.pendingSuggestion.profiles.email || 'Unknown';
    }
    
    // Create action buttons
    let actionButtons = [];
    
    if (isPendingSuggestion) {
      // For pending suggestions, show approve and reject buttons
      actionButtons = [
        createApproveButton(() => acceptSplitSuggestion(
          expense.pendingSuggestion.id, 
          expense.pendingSuggestion.expense_id, 
          expense.pendingSuggestion.suggested_amount
        )),
        createRejectButton(() => rejectSplitSuggestion(expense.pendingSuggestion.id))
      ];
    } else {
      // For regular expenses, show edit and delete buttons
      actionButtons = [
        createEditButton(() => editExpense(expense)),
        createDeleteButton(() => confirmDeleteExpense(expense))
      ];
    }
    
    const row = createTableRow(
      [
        expense.name,
        amountElement,
        getFrequencyDisplayName(displayFrequency),
        accountName,
        categoryTag,
        splitElement,
        creatorName
      ],
      actionButtons
    );
    
    // Add a special class for pending suggestions
    if (isPendingSuggestion) {
      row.classList.add('suggestion-pending');
    }
    
    tableBody.appendChild(row);
  });
}

// Create an approve button
function createApproveButton(onClick) {
  const button = document.createElement('button');
  button.className = 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 p-1';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
  `;
  button.title = 'Approve';
  button.addEventListener('click', onClick);
  return button;
}

// Create a reject button
function createRejectButton(onClick) {
  const button = document.createElement('button');
  button.className = 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  `;
  button.title = 'Reject';
  button.addEventListener('click', onClick);
  return button;
}

// Get split ratio for current user
function getSplitRatio(expense) {
  if (!expense.expense_splits || expense.expense_splits.length === 0) {
    return 1.0; // Default to 100% if no splits are found
  }
  
  const currentUserId = getCurrentUser()?.id;
  const userSplit = expense.expense_splits.find(split => split.user_id === currentUserId);
  
  // If we found the current user's split, return that ratio
  if (userSplit) {
    return userSplit.ratio;
  }
  
  // If the current user doesn't have a split (viewing someone else's expense)
  // Just return the first split's ratio as an approximation
  if (expense.expense_splits.length > 0) {
    return expense.expense_splits[0].ratio;
  }
  
  return 1.0; // Default to 100%
}

// Get split type from expense splits
function getSplitType(expense) {
  if (!expense.expense_splits || expense.expense_splits.length === 0) {
    return 'me'; // Default to just me if no splits are found
  }
  
  const currentUserId = getCurrentUser()?.id;
  const userSplit = expense.expense_splits.find(split => split.user_id === currentUserId);
  
  // If there's only one split and it's for the current user with 100% ratio
  if (expense.expense_splits.length === 1 && userSplit && Math.abs(userSplit.ratio - 1.0) < 0.001) {
    return 'me'; // Just me
  }
  
  // If the current user's split is not found, check if they have a pending suggestion
  if (!userSplit && expense.pendingSuggestion) {
    // If the suggested ratio is 0, this is a "Just Me" expense for the other user
    if (Math.abs(expense.pendingSuggestion.suggested_ratio) < 0.001) {
      return 'me';
    }
  }
  
  // If the current user's split has a ratio of 0, this is a "Just Me" expense for someone else
  if (userSplit && Math.abs(userSplit.ratio) < 0.001) {
    return 'me';
  }
  
  // Check if all non-zero splits are equal
  const nonZeroSplits = expense.expense_splits.filter(split => split.ratio > 0.001);
  const splitCount = nonZeroSplits.length;
  
  if (splitCount > 0) {
    const expectedRatio = 1 / splitCount;
    const allEqual = nonZeroSplits.every(split => 
      Math.abs(split.ratio - expectedRatio) < 0.001
    );
    
    return allEqual ? 'equal' : 'per-dollar';
  }
  
  // Default to per-dollar if we can't determine
  return 'per-dollar';
}

// Show expense form
function showExpenseForm(expense = null) {
  const modalTitle = document.getElementById('expense-modal-title');
  const expenseForm = document.getElementById('expense-form');
  const expenseId = document.getElementById('expense-id');
  const expenseName = document.getElementById('expense-name');
  const expenseAmount = document.getElementById('expense-amount');
  const expenseFrequency = document.getElementById('expense-frequency');
  const expenseAccount = document.getElementById('expense-account');
  const expenseCategory = document.getElementById('expense-category');
  const expenseSplitType = document.getElementById('expense-split-type');
  
  // Reset form
  expenseForm.reset();
  
  // Set form values if editing
  if (expense) {
    modalTitle.textContent = 'Edit Expense';
    expenseId.value = expense.id;
    expenseName.value = expense.name;
    expenseAmount.value = expense.raw_amount;
    expenseFrequency.value = expense.raw_frequency;
    expenseAccount.value = expense.account_id || '';
    expenseCategory.value = expense.category_id || '';
    
    // Set split type
    expenseSplitType.value = getSplitType(expense);
    
    // Load split users
    loadSplitUsers(expense);
  } else {
    modalTitle.textContent = 'Add Expense';
    expenseId.value = '';
    expenseSplitType.value = 'equal';
    
    // Initialize empty split
    initializeSplitUsers();
  }
  
  // Set up split type change handler
  expenseSplitType.addEventListener('change', () => {
    updateSplitUI(expenseSplitType.value);
  });
  
  // Set up account change handler to update split users based on account owners
  expenseAccount.addEventListener('change', () => {
    console.log('Account selection changed, reinitializing split users');
    initializeSplitUsers();
  });
  
  // Initialize split UI
  updateSplitUI(expenseSplitType.value);
  
  // Show modal
  showModal('expense-modal');
}

// Initialize split users
async function initializeSplitUsers() {
  console.log('Initializing split users');
  
  // Get current user
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.error('No current user found');
    return;
  }
  
  // Get account owners if an account is selected
  const accountSelect = document.getElementById('expense-account');
  const accountId = accountSelect.value;
  
  console.log('Selected account ID:', accountId);
  
  if (accountId) {
    const account = getAccountById(accountId);
    console.log('Account details:', account);
    
    if (account && account.owner_ids && account.owner_ids.length > 0) {
      console.log('Account has owners, loading users for split:', account.owner_ids);
      await loadUsersForSplit(account.owner_ids);
      return;
    } else {
      console.log('Account has no owners or owner_ids is not defined');
    }
  } else {
    console.log('No account selected');
  }
  
  // Default to current user only if no account is selected or account has no owners
  console.log('Defaulting to current user only');
  const splitUsers = [
    {
      id: currentUser.id,
      name: currentUser.profile?.name || 'Me',
      email: currentUser.email,
      ratio: 1.0
    }
  ];
  
  // Only add partner if we're not in an account context
  if (!accountId) {
    const partner = await getPartnerUser();
    if (partner) {
      console.log('Adding partner to split:', partner);
      splitUsers[0].ratio = 0.5; // Adjust current user's ratio
      splitUsers.push({
        id: partner.id,
        name: partner.name,
        email: partner.email,
        ratio: 0.5
      });
    }
  }
  
  console.log('Final split users:', splitUsers);
  renderSplitUsers(splitUsers);
}

// Load users for split
async function loadUsersForSplit(userIds) {
  console.log('Loading users for split with IDs:', userIds);
  
  if (!userIds || userIds.length === 0) {
    console.log('No user IDs provided, rendering empty split users');
    renderSplitUsers([]);
    return;
  }
  
  // Get current user to ensure they're always included
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.error('No current user found');
    return;
  }
  
  // Fetch user details for each ID
  const { data, error } = await window.supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);
  
  if (error) {
    console.error('Error loading users for split:', error);
    return;
  }
  
  console.log('Loaded users from database:', data);
  
  // Check if all user IDs were found
  const foundUserIds = new Set(data?.map(user => user.id) || []);
  const missingUserIds = userIds.filter(id => !foundUserIds.has(id));
  
  if (missingUserIds.length > 0) {
    console.warn('Some users were not found in the database:', missingUserIds);
  }
  
  // Make sure current user is included
  let splitUsers = data || [];
  if (!splitUsers.some(user => user.id === currentUser.id)) {
    console.log('Adding current user to split users');
    splitUsers.push({
      id: currentUser.id,
      name: currentUser.profile?.name || 'Me',
      email: currentUser.email
    });
  }
  
  // Calculate equal ratio
  const equalRatio = 1 / (splitUsers.length || 1);
  
  // Add ratio to each user
  splitUsers = splitUsers.map(user => ({
    ...user,
    ratio: equalRatio
  }));
  
  console.log('Final split users with ratios:', splitUsers);
  renderSplitUsers(splitUsers);
}

// Load split users from expense
async function loadSplitUsers(expense) {
  console.log('Loading split users for expense:', expense);
  
  // Get the account for this expense
  const account = getAccountById(expense.account_id);
  
  // Get current user
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.error('No current user found');
    return;
  }
  
  // If this is a shared account, we need to include all account owners
  if (account && account.owner_ids && account.owner_ids.length > 1) {
    console.log('This is a shared account, loading all account owners');
    
    // Get all user IDs from the account
    const userIds = account.owner_ids;
    
    // Fetch user details for each ID
    const { data, error } = await window.supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds);
    
    if (error) {
      console.error('Error loading split users:', error);
      return;
    }
    
    // Get the split type
    const splitType = getSplitType(expense);
    console.log('Split type determined:', splitType);
    
    // Combine user details with split ratios
    const splitUsers = (data || []).map(user => {
      // Find this user's split if it exists
      const split = expense.expense_splits ? 
        expense.expense_splits.find(s => s.user_id === user.id) : null;
      
      // For "Just Me" expenses, only the current user should have a non-zero ratio
      if (splitType === 'me') {
        return {
          ...user,
          ratio: user.id === currentUser.id ? 1.0 : 0.0
        };
      }
      
      // For other split types, use the existing ratio or default to equal split
      return {
        ...user,
        ratio: split ? split.ratio : (1.0 / data.length)
      };
    });
    
    console.log('Final split users:', splitUsers);
    renderSplitUsers(splitUsers);
    return;
  }
  
  // If not a shared account or no expense splits, initialize with default values
  if (!expense.expense_splits || expense.expense_splits.length === 0) {
    console.log('No expense splits found, initializing with defaults');
    await initializeSplitUsers();
    return;
  }
  
  // For non-shared accounts, just use the existing splits
  console.log('Using existing expense splits');
  
  // Get user IDs from splits
  const userIds = expense.expense_splits.map(split => split.user_id);
  
  // Fetch user details for each ID
  const { data, error } = await window.supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);
  
  if (error) {
    console.error('Error loading split users:', error);
    return;
  }
  
  // Combine user details with split ratios
  const splitUsers = (data || []).map(user => {
    const split = expense.expense_splits.find(s => s.user_id === user.id);
    return {
      ...user,
      ratio: split ? split.ratio : 0
    };
  });
  
  console.log('Final split users:', splitUsers);
  renderSplitUsers(splitUsers);
}

// Render split users
function renderSplitUsers(users) {
  const container = document.getElementById('expense-split-container');
  if (!container) return;
  
  // Store users in a data attribute
  container.dataset.splitUsers = JSON.stringify(users);
  
  // Update UI based on current split type
  const splitType = document.getElementById('expense-split-type').value;
  updateSplitUI(splitType);
}

// Update split UI based on type
function updateSplitUI(splitType) {
  const container = document.getElementById('expense-split-container');
  if (!container) return;

  const splitUsers = JSON.parse(container.dataset.splitUsers || '[]');
  container.innerHTML = '';

  // Get the selected account
  const accountId = document.getElementById('expense-account').value;
  const account = getAccountById(accountId);
  const isSharedAccount = account && account.owner_ids && account.owner_ids.length > 1;

  // If not shared, show a message, force "me"
  if (!isSharedAccount) {
    container.innerHTML = `
      <div class="text-sm text-gray-500 dark:text-gray-400 italic">
        Splitting is only available for accounts with multiple users.
      </div>
    `;
    const splitTypeSelect = document.getElementById('expense-split-type');
    if (splitTypeSelect && splitTypeSelect.value !== 'me') {
      splitTypeSelect.value = 'me';
    }
    return;
  }

  const relevantUsers = splitUsers.filter(user =>
    account && account.owner_ids && account.owner_ids.includes(user.id)
  );
  if (relevantUsers.length === 0) {
    container.innerHTML = `
      <div class="text-sm text-gray-500 dark:text-gray-400 italic">
        No users available for splitting.
      </div>
    `;
    return;
  }

  const currentUserId = getCurrentUser()?.id;

  if (splitType === 'per-dollar') {
    // Note about RLS
    const noteElement = document.createElement('div');
    noteElement.className = 'text-xs text-amber-500 dark:text-amber-400 mb-3';
    noteElement.textContent =
      'Note: Due to security restrictions, only you can modify your own splits. Other users must accept any changes.';
    container.appendChild(noteElement);
  }

  // ============== SPLIT TYPE LOGIC ==============
  if (splitType === 'me') {
    // Force only current user at 100%
    relevantUsers.forEach(user => {
      user.ratio = user.id === currentUserId ? 1.0 : 0.0;
    });
    
    // Add a note explaining "Just Me" in shared accounts
    if (isSharedAccount) {
      const noteElement = document.createElement('div');
      noteElement.className = 'text-xs text-amber-500 dark:text-amber-400 mb-3';
      noteElement.textContent =
        'Note: "Just Me" means this expense is 100% yours. Other account members will see this expense with 0% share.';
      container.appendChild(noteElement);
    }
    
    // Show all users, with current user at 100% and others at 0%
    relevantUsers.forEach(user => {
      const isCurrentUser = user.id === currentUserId;
      const userElement = document.createElement('div');
      userElement.className = 'flex items-center justify-between';
      userElement.innerHTML = `
        <div class="text-sm">${user.name}${isCurrentUser ? ' (You)' : ''}</div>
        <div class="text-sm font-medium">${isCurrentUser ? '100%' : '0%'}</div>
      `;
      container.appendChild(userElement);
    });

  } else if (splitType === 'equal') {
    // Equal ratio for all
    const equalRatio = 1 / relevantUsers.length;
    relevantUsers.forEach(user => {
      user.ratio = equalRatio;
      const isCurrentUser = user.id === currentUserId;
      const userElement = document.createElement('div');
      userElement.className = 'flex items-center justify-between';
      userElement.innerHTML = `
        <div class="text-sm">${user.name}${isCurrentUser ? ' (You)' : ''}</div>
        <div class="text-sm font-medium">${Math.round(equalRatio * 100)}%</div>
      `;
      container.appendChild(userElement);
    });

  } else {
    // "Per-dollar" split
    const expenseAmount = parseFloat(document.getElementById('expense-amount').value) || 0;

    // Header
    const headerElement = document.createElement('div');
    headerElement.className = 'flex items-center justify-between mb-3 border-b pb-2';
    headerElement.innerHTML = `
      <div class="text-sm font-medium">User</div>
      <div class="text-sm font-medium">Amount (${formatCurrency(expenseAmount)})</div>
    `;
    container.appendChild(headerElement);

    // Basic instructions
    const noteElement = document.createElement('div');
    noteElement.className = 'text-xs text-gray-500 dark:text-gray-400 mb-3';
    noteElement.textContent =
      'Enter dollar amounts for each user. Once you tab out of a field, the difference is spread to other unlocked users.';
    container.appendChild(noteElement);

    // Show lock checkboxes if 3+ users
    const showLockCheckboxes = relevantUsers.length >= 3;

    relevantUsers.forEach(user => {
      const dollarAmount = expenseAmount * user.ratio;
      const isCurrentUser = user.id === currentUserId;

      const userElement = document.createElement('div');
      userElement.className = 'flex items-center space-x-2 mb-2';

      let userNameHtml = `<div class="text-sm flex-grow flex items-center"><span>${user.name}${isCurrentUser ? ' (You)' : ''}</span></div>`;
      if (showLockCheckboxes) {
        userNameHtml = `
          <div class="text-sm flex-grow flex items-center">
            <input type="checkbox" class="mr-2" data-lockFor="${user.id}">
            <span>${user.name}${isCurrentUser ? ' (You)' : ''}</span>
          </div>
        `;
      }

      userElement.innerHTML = `
        ${userNameHtml}
        <input
          type="number"
          class="input w-24"
          min="0"
          step="0.01"
          value="${dollarAmount.toFixed(2)}"
          data-user-id="${user.id}"
        >
        <div class="text-sm text-gray-500" data-percentage-for="${user.id}">
          ${Math.round(user.ratio * 100)}%
        </div>
      `;

      // Handle lock checkbox
      if (showLockCheckboxes) {
        const lockCheckbox = userElement.querySelector(
          `input[type="checkbox"][data-lockFor="${user.id}"]`
        );
        if (lockCheckbox) {
          lockCheckbox.addEventListener('change', () => {
            const numberInput = userElement.querySelector('input[type="number"]');
            numberInput.disabled = lockCheckbox.checked;
            if (lockCheckbox.checked) {
              numberInput.classList.add('bg-gray-100', 'dark:bg-dark-300');
            } else {
              numberInput.classList.remove('bg-gray-100', 'dark:bg-dark-300');
            }
          });
        }
      }

      // On blur => redistribute difference, but skip adjusting THIS field
      const amountInput = userElement.querySelector(`input[data-user-id="${user.id}"]`);
      amountInput.addEventListener('blur', () => {
        updatePerDollarSplitRatios(user.id);
      });

      container.appendChild(userElement);
    });

    // "Split Equally" button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-3 flex space-x-2';

    const splitEquallyButton = document.createElement('button');
    splitEquallyButton.type = 'button';
    splitEquallyButton.className = 'btn btn-secondary text-xs py-1 px-2';
    splitEquallyButton.textContent = 'Split Equally';
    splitEquallyButton.addEventListener('click', (e) => {
      e.preventDefault();
      splitEquallyPerDollar();
    });

    buttonContainer.appendChild(splitEquallyButton);
    container.appendChild(buttonContainer);
  }

  // Store final user data
  container.dataset.splitUsers = JSON.stringify(relevantUsers);
}

// Update only percentages without adjusting values
function updatePercentagesOnly() {
  const container = document.getElementById('expense-split-container');
  if (!container) return;
  
  // Get split users
  const splitUsers = JSON.parse(container.dataset.splitUsers || '[]');
  
  // Get expense amount
  const expenseAmount = parseFloat(document.getElementById('expense-amount').value) || 0;
  
  // Get all inputs
  const inputs = container.querySelectorAll('input[type="number"]');
  
  // Calculate total assigned amount
  let totalAssigned = 0;
  inputs.forEach(input => {
    totalAssigned += parseFloat(input.value) || 0;
  });
  
  // Update ratios and percentages
  inputs.forEach(input => {
    const userId = input.dataset.userId;
    const dollarAmount = parseFloat(input.value) || 0;
    
    // Find user and update ratio
    const user = splitUsers.find(u => u.id === userId);
    if (user) {
      user.ratio = expenseAmount > 0 ? dollarAmount / expenseAmount : 0;
      
      // Update percentage display
      const percentageElement = container.querySelector(`[data-percentage-for="${userId}"]`);
      if (percentageElement) {
        percentageElement.textContent = `${Math.round(user.ratio * 100)}%`;
      }
    }
  });
  
  // Update the data attribute
  container.dataset.splitUsers = JSON.stringify(splitUsers);
  
  // Update remaining amount
  const remainingElement = document.getElementById('remaining-amount');
  if (remainingElement) {
    const remaining = expenseAmount - totalAssigned;
    remainingElement.textContent = formatCurrency(remaining);
    
    // Highlight if there's a discrepancy
    if (Math.abs(remaining) > 0.01) {
      remainingElement.classList.add('text-red-500');
    } else {
      remainingElement.classList.remove('text-red-500');
    }
  }
}

// Update per-dollar split ratios
function updatePerDollarSplitRatios(changedUserId) {
  const container = document.getElementById('expense-split-container');
  if (!container) return;

  // Total expense
  const expenseAmount = parseFloat(document.getElementById('expense-amount').value) || 0;
  if (expenseAmount <= 0) return; // No calc if zero or invalid

  const inputs = container.querySelectorAll('input[type="number"][data-user-id]');
  if (!inputs || inputs.length === 0) return;

  // 1) Sum up all typed amounts
  let totalAssigned = 0;
  inputs.forEach(input => {
    totalAssigned += parseFloat(input.value) || 0;
  });

  // 2) Calculate the difference
  let difference = expenseAmount - totalAssigned;
  if (Math.abs(difference) < 0.01) {
    difference = 0; // ignore tiny floating differences
  }

  // 3) Distribute difference among *other* unlocked fields
  if (difference !== 0) {
    // Gather all "unlocked" inputs except the changedUserId
    const unlockedInputs = Array.from(inputs).filter(input => {
      const userId = input.dataset.userId;
      if (userId === changedUserId) {
        return false; // skip the field the user just edited
      }
      const lockCheckbox = container.querySelector(`input[type="checkbox"][data-lockFor="${userId}"]`);
      // If no checkbox, it's unlocked
      const locked = lockCheckbox && lockCheckbox.checked;
      return !locked;
    });

    if (unlockedInputs.length > 0) {
      const addPerInput = difference / unlockedInputs.length;
      unlockedInputs.forEach(input => {
        const currentVal = parseFloat(input.value) || 0;
        let newVal = currentVal + addPerInput;
        if (newVal < 0) newVal = 0; // avoid negative
        input.value = newVal.toFixed(2);
      });
    }
  }

  // 4) Re-sum after distribution
  let finalAssigned = 0;
  inputs.forEach(input => {
    finalAssigned += parseFloat(input.value) || 0;
  });

  // 5) Update each user's ratio & text label
  const splitUsers = JSON.parse(container.dataset.splitUsers || '[]');

  inputs.forEach(input => {
    const userId = input.dataset.userId;
    const assignedAmount = parseFloat(input.value) || 0;
    const user = splitUsers.find(u => u.id === userId);
    if (user) {
      user.ratio = expenseAmount > 0 ? (assignedAmount / expenseAmount) : 0;
    }
    // Update the displayed percentage
    const pctElement = container.querySelector(`[data-percentage-for="${userId}"]`);
    if (pctElement) {
      pctElement.textContent = `${Math.round(user.ratio * 100)}%`;
    }
  });

  // 6) Store updated user data
  container.dataset.splitUsers = JSON.stringify(splitUsers);
}

// Split equally per dollar
function splitEquallyPerDollar() {
  const container = document.getElementById('expense-split-container');
  if (!container) return;
  
  // Get split users
  const splitUsers = JSON.parse(container.dataset.splitUsers || '[]');
  
  // Get expense amount
  const expenseAmount = parseFloat(document.getElementById('expense-amount').value) || 0;
  
  if (expenseAmount <= 0 || splitUsers.length === 0) {
    return;
  }
  
  // Get all inputs
  const inputs = container.querySelectorAll('input[type="number"]');
  
  // Calculate equal share
  const equalShare = expenseAmount / inputs.length;
  
  // Set each input to the equal share
  inputs.forEach(input => {
    input.value = equalShare.toFixed(2);
  });
  
  // Update ratios
  updatePerDollarSplitRatios();
}

// Suggest a split to another user
async function suggestSplit(expenseId, toUserId, amount, ratio) {
  console.log(`Suggesting split for expense ${expenseId} to user ${toUserId} with amount ${amount} and ratio ${ratio}`);
  
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser || !currentUser.user) {
      console.error('No user logged in');
      return { success: false, error: 'You must be logged in to suggest splits' };
    }
    
    const fromUserId = currentUser.user.id;
    console.log(`Current user ID (from_user_id): ${fromUserId}`);
    
    // Get the expense details
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single();
    
    if (expenseError) {
      console.error('Error fetching expense:', expenseError);
      return { success: false, error: 'Could not find the expense' };
    }
    
    if (!expense) {
      return { success: false, error: 'Expense not found' };
    }
    
    console.log('Expense details:', expense);
    
    // Create a split suggestion
    const suggestionData = {
      expense_id: expenseId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      suggested_amount: amount,
      suggested_ratio: ratio,
      status: 'pending'
    };
    
    console.log('Creating split suggestion with data:', suggestionData);
    
    const { data: suggestion, error: suggestionError } = await supabase
      .from('split_suggestions')
      .insert([suggestionData])
      .select();
    
    if (suggestionError) {
      console.error('Error creating split suggestion:', suggestionError);
      return { success: false, error: 'Failed to create split suggestion' };
    }
    
    console.log('Split suggestion created successfully:', suggestion);
    
    // Update the suggestions count for the recipient
    try {
      // This is a client-side function that would update the UI
      // In a real app, you might use a server-side function or WebSockets
      if (typeof updateSuggestionsCount === 'function') {
        updateSuggestionsCount();
      }
      
      // Also try to load notifications if that function exists
      if (typeof loadNotifications === 'function') {
        loadNotifications();
      }
    } catch (e) {
      console.warn('Could not update suggestions count:', e);
      // Non-critical error, continue
    }
    
    return { success: true, data: suggestion };
  } catch (e) {
    console.error('Exception during split suggestion:', e);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// Save expense
async function saveExpense(formData) {
  const expenseId = formData.get('expense-id');
  const name = formData.get('expense-name');
  const rawAmount = parseFloat(formData.get('expense-amount'));
  const rawFrequency = formData.get('expense-frequency');
  const accountId = formData.get('expense-account') || null;
  const categoryId = formData.get('expense-category') || null;
  const splitType = formData.get('expense-split-type');
  
  // Get current user ID
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) {
    console.error('Cannot save expense: No current user ID');
    return;
  }
  
  if (!name) {
    console.error('Please enter an expense name.');
    return;
  }
  
  if (isNaN(rawAmount) || rawAmount <= 0) {
    console.error('Please enter a valid amount.');
    return;
  }
  
  if (!rawFrequency) {
    console.error('Please enter a frequency.');
    return;
  }
  
  // Calculate normalised amount (monthly)
  const parsedFrequency = parseFrequency(rawFrequency);
  const normalisedAmount = convertAmount(rawAmount, parsedFrequency, 'monthly');
  
  // Get split users
  const container = document.getElementById('expense-split-container');
  const splitUsers = JSON.parse(container.dataset.splitUsers || '[]');
  
  // Create or update expense
  let result;
  
  if (expenseId) {
    // Update existing expense
    result = await window.supabase
      .from('expenses')
      .update({
        name,
        raw_amount: rawAmount,
        raw_frequency: rawFrequency,
        normalised_amount: normalisedAmount,
        account_id: accountId,
        category_id: categoryId,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId)
      .select();
  } else {
    // Create new expense
    result = await window.supabase
      .from('expenses')
      .insert({
        name,
        raw_amount: rawAmount,
        raw_frequency: rawFrequency,
        normalised_amount: normalisedAmount,
        account_id: accountId,
        category_id: categoryId,
        created_by_id: currentUserId
      })
      .select();
  }
  
  const { data, error } = result;
  
  if (error) {
    console.error('Error saving expense:', error);
    return;
  }
  
  console.log('Expense save response data:', data);
  
  // Get the expense ID (either from the form or from the newly created expense)
  let savedExpenseId = expenseId;
  
  if (!savedExpenseId && data) {
    // For new expenses, extract the ID from the response
    if (Array.isArray(data) && data.length > 0) {
      savedExpenseId = data[0].id;
    } else if (data.id) {
      savedExpenseId = data.id;
    }
  }
  
  if (!savedExpenseId) {
    console.error('Could not determine expense ID after save');
    return;
  }
  
  console.log('Saved expense ID:', savedExpenseId);
  
  // Save expense splits
  await saveExpenseSplits(savedExpenseId, splitUsers);
  
  // Reload expenses
  await loadExpenses();
  
  // Update dashboard
  updateDashboard();
  
  // Hide modal
  hideModal('expense-modal');
}

// Save expense splits
async function saveExpenseSplits(expenseId, splitUsers) {
  console.log('Saving expense splits for expense ID:', expenseId);
  console.log('Split users:', splitUsers);
  
  if (!expenseId) {
    console.error('Cannot save expense splits: No expense ID provided');
    return;
  }
  
  if (!splitUsers || splitUsers.length === 0) {
    console.error('Cannot save expense splits: No split users provided');
    return;
  }
  
  // Get current user ID
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) {
    console.error('Cannot save expense splits: No current user ID');
    return;
  }
  
  // Delete existing splits for this expense (only for current user due to RLS)
  const { error: deleteError } = await window.supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', expenseId)
    .eq('user_id', currentUserId);
  
  if (deleteError) {
    console.error('Error deleting existing expense splits:', deleteError);
    return;
  }
  
  console.log('Deleted existing expense splits for expense ID:', expenseId);
  
  // Get the current user's split
  const currentUserSplit = splitUsers.find(user => user.id === currentUserId);
  
  // Create new split for current user
  if (currentUserSplit) {
    const { data: splitData, error: splitError } = await window.supabase
      .from('expense_splits')
      .insert({
        expense_id: expenseId,
        user_id: currentUserId,
        ratio: currentUserSplit.ratio
      })
      .select();
    
    if (splitError) {
      console.error('Error creating expense split for current user:', splitError);
      return;
    }
    
    console.log('Successfully created expense split for current user:', splitData);
  } else {
    console.log('Current user is not part of this expense split');
  }
  
  // Get the expense details to check the account
  const { data: expenseData, error: expenseError } = await window.supabase
    .from('expenses')
    .select('*, accounts(*)')
    .eq('id', expenseId)
    .single();
  
  if (expenseError) {
    console.error('Error fetching expense details for suggestions:', expenseError);
    return;
  }
  
  const expense = expenseData;
  const account = expense.accounts;
  
  // Get the split type from the form
  const splitType = document.getElementById('expense-split-type')?.value || 'me';
  
  // For shared accounts, we need to handle all users, even those with zero ratios
  if (account && account.owner_ids && account.owner_ids.length > 1) {
    console.log('This is a shared account with multiple owners');
    
    // Get all account owners except the current user
    const otherOwnerIds = account.owner_ids.filter(id => id !== currentUserId);
    
    if (otherOwnerIds.length > 0) {
      console.log('Other account owners:', otherOwnerIds);
      
      // Delete existing pending suggestions for this expense from this user
      const { error: deleteSuggestionError } = await window.supabase
        .from('split_suggestions')
        .delete()
        .eq('expense_id', expenseId)
        .eq('from_user_id', currentUserId)
        .eq('status', 'pending');
      
      if (deleteSuggestionError) {
        console.error('Error deleting existing split suggestions:', deleteSuggestionError);
      }
      
      // Calculate the amount for each user based on the expense amount
      const expenseAmount = parseFloat(expense.raw_amount) || 0;
      
      // For "Just Me" expenses, create suggestions with zero ratios for other users
      if (splitType === 'me') {
        console.log('This is a "Just Me" expense, creating zero ratio suggestions for other owners');
        
        // Create suggestions with zero ratios for all other account owners
        for (const ownerId of otherOwnerIds) {
          const { data: suggestionData, error: suggestionError } = await window.supabase
            .from('split_suggestions')
            .insert({
              expense_id: expenseId,
              from_user_id: currentUserId,
              to_user_id: ownerId,
              suggested_ratio: 0.0,
              suggested_amount: 0.0,
              status: 'pending'
            })
            .select();
          
          if (suggestionError) {
            console.error(`Error creating zero ratio suggestion for user ${ownerId}:`, suggestionError);
          } else {
            console.log(`Successfully created zero ratio suggestion for user ${ownerId}:`, suggestionData);
          }
        }
      } else {
        // For other split types, create suggestions based on the ratios
        console.log('Creating split suggestions based on ratios');
        
        // Find other users in the split users array
        for (const ownerId of otherOwnerIds) {
          const otherUser = splitUsers.find(user => user.id === ownerId);
          const ratio = otherUser ? otherUser.ratio : 0.0;
          const suggestedAmount = expenseAmount * ratio;
          
          const { data: suggestionData, error: suggestionError } = await window.supabase
            .from('split_suggestions')
            .insert({
              expense_id: expenseId,
              from_user_id: currentUserId,
              to_user_id: ownerId,
              suggested_ratio: ratio,
              suggested_amount: suggestedAmount,
              status: 'pending'
            })
            .select();
          
          if (suggestionError) {
            console.error(`Error creating split suggestion for user ${ownerId}:`, suggestionError);
          } else {
            console.log(`Successfully created split suggestion for user ${ownerId}:`, suggestionData);
          }
        }
      }
      
      console.log(`Split suggestions have been sent to ${otherOwnerIds.length} other account owner(s).`);
    }
  } else {
    console.log('This is not a shared account or has no other owners, not sending split suggestions');
  }
}

// Edit expense
function editExpense(expense) {
  showExpenseForm(expense);
}

// Confirm delete expense
function confirmDeleteExpense(expense) {
  showConfirmation(
    'Delete Expense',
    `Are you sure you want to delete the expense "${expense.name}"?`,
    () => deleteExpense(expense.id)
  );
}

// Delete expense
async function deleteExpense(expenseId) {
  // Delete expense splits first
  await saveExpenseSplits(expenseId, []);
  
  // Delete expense
  const { error } = await window.supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);
  
  if (error) {
    console.error('Error deleting expense:', error);
    return;
  }
  
  // Reload expenses
  await loadExpenses();
}

// Get category by ID
function getCategoryById(categoryId) {
  return categories.find(category => category.id === categoryId);
}

// Get expenses by account
function getExpensesByAccount(accountId) {
  return expenses.filter(expense => expense.account_id === accountId);
}

// Get expenses by category
function getExpensesByCategory(categoryId) {
  return expenses.filter(expense => expense.category_id === categoryId);
}

// Get total expenses amount
function getTotalExpensesAmount(frequency = 'monthly') {
  return expenses.reduce((total, expense) => {
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, frequency);
    return total + amount;
  }, 0);
}

// Get total expenses amount for account
function getTotalExpensesAmountForAccount(accountId, frequency = 'monthly') {
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) return 0;
  
  return getExpensesByAccount(accountId).reduce((total, expense) => {
    // Skip pending suggestions in dashboard calculations
    if (expense.pendingSuggestion) {
      return total;
    }
    
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, frequency);
    
    // Get the user's split ratio for this expense
    const splitRatio = getSplitRatio(expense);
    
    // Calculate the user's share of this expense
    const userShare = amount * splitRatio;
    
    return total + userShare;
  }, 0);
}

// Get total expenses amount for category
function getTotalExpensesAmountForCategory(categoryId, frequency = 'monthly') {
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) return 0;
  
  return getExpensesByCategory(categoryId).reduce((total, expense) => {
    // Skip pending suggestions in dashboard calculations
    if (expense.pendingSuggestion) {
      return total;
    }
    
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, frequency);
    
    // Get the user's split ratio for this expense
    const splitRatio = getSplitRatio(expense);
    
    // Calculate the user's share of this expense
    const userShare = amount * splitRatio;
    
    return total + userShare;
  }, 0);
}

// Get user's share of expenses
function getUserShareOfExpenses(frequency = 'monthly') {
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) return 0;
  
  return expenses.reduce((total, expense) => {
    // Skip pending suggestions in dashboard calculations
    if (expense.pendingSuggestion) {
      return total;
    }
    
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, frequency);
    
    // Get the user's split ratio for this expense
    const splitRatio = getSplitRatio(expense);
    
    // Calculate the user's share of this expense
    const userShare = amount * splitRatio;
    
    return total + userShare;
  }, 0);
}

// Handle column sort
function handleColumnSort(column) {
  // If clicking the same column, toggle direction
  if (column === currentSortColumn) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    // If clicking a new column, set it as current and default to ascending
    currentSortColumn = column;
    currentSortDirection = 'asc';
  }
  
  // Update sort indicators in the UI
  updateSortIndicators();
  
  // Re-render expenses with new sort
  renderExpenses();
}

// Update sort indicators in the table headers
function updateSortIndicators() {
  // Remove all existing sort indicators
  document.querySelectorAll('.sort-indicator').forEach(el => el.remove());
  
  // Find all sortable headers
  const headers = document.querySelectorAll('th[data-sort]');
  headers.forEach(header => {
    // Remove existing classes
    header.classList.remove('text-blue-600', 'dark:text-blue-400');
    
    // Add hover effect to all sortable headers
    if (!header.classList.contains('sortable-header')) {
      header.classList.add('sortable-header');
      header.style.cursor = 'pointer';
      header.style.position = 'relative';
      header.style.userSelect = 'none';
      
      // Add tooltip
      const sortColumn = header.getAttribute('data-sort');
      const columnName = sortColumn.charAt(0).toUpperCase() + sortColumn.slice(1);
      
      if (sortColumn === currentSortColumn) {
        const nextDirection = currentSortDirection === 'asc' ? 'descending' : 'ascending';
        header.title = `Click to sort by ${columnName} in ${nextDirection} order`;
      } else {
        header.title = `Click to sort by ${columnName}`;
      }
      
      // Add hover effect
      header.addEventListener('mouseover', () => {
        if (header.getAttribute('data-sort') !== currentSortColumn) {
          header.classList.add('text-gray-700', 'dark:text-gray-300');
        }
      });
      
      header.addEventListener('mouseout', () => {
        if (header.getAttribute('data-sort') !== currentSortColumn) {
          header.classList.remove('text-gray-700', 'dark:text-gray-300');
        }
      });
    }
    
    // Add sort indicator to current sort column
    if (header.getAttribute('data-sort') === currentSortColumn) {
      // Highlight the current sort column
      header.classList.add('text-blue-600', 'dark:text-blue-400');
      
      // Add the sort indicator (default browser arrows)
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator ml-1';
      indicator.innerHTML = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
      header.appendChild(indicator);
    }
  });
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Add expense button
  const addExpenseButton = document.getElementById('add-expense-button');
  if (addExpenseButton) {
    addExpenseButton.addEventListener('click', () => {
      showExpenseForm();
    });
  }
  
  // Set up sortable column headers
  const tableHeaders = document.querySelectorAll('th[data-sort]');
  tableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      handleColumnSort(column);
    });
  });
  
  // Close expense modal button
  const closeExpenseModalButton = document.getElementById('close-expense-modal');
  if (closeExpenseModalButton) {
    closeExpenseModalButton.addEventListener('click', () => {
      hideModal('expense-modal');
    });
  }
  
  // Cancel expense button
  const cancelExpenseButton = document.getElementById('cancel-expense');
  if (cancelExpenseButton) {
    cancelExpenseButton.addEventListener('click', () => {
      hideModal('expense-modal');
    });
  }
  
  // Expense form submission
  const expenseForm = document.getElementById('expense-form');
  if (expenseForm) {
    expenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(expenseForm);
      await saveExpense(formData);
    });
  }
  
  // Expense split slider
  const expenseSplit = document.getElementById('expense-split');
  if (expenseSplit) {
    expenseSplit.addEventListener('input', (e) => {
      updateSplitValueText(e.target.value);
    });
  }
  
  // Frequency selector
  const frequencySelector = document.getElementById('frequency-selector');
  if (frequencySelector) {
    frequencySelector.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        showModal('custom-frequency-modal');
      } else {
        renderExpenses();
        updateDashboard();
      }
    });
  }
  
  // Custom frequency form
  const customFrequencyForm = document.getElementById('custom-frequency-form');
  if (customFrequencyForm) {
    customFrequencyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const value = document.getElementById('frequency-value').value;
      const unit = document.getElementById('frequency-unit').value;
      
      // Create a custom frequency option
      const frequencySelector = document.getElementById('frequency-selector');
      const customOption = document.createElement('option');
      customOption.value = `custom-${value}-${unit}`;
      customOption.textContent = `Every ${value} ${unit}`;
      customOption.selected = true;
      
      // Remove any existing custom option
      const existingCustomOption = frequencySelector.querySelector('option[value^="custom-"]');
      if (existingCustomOption) {
        frequencySelector.removeChild(existingCustomOption);
      }
      
      // Add the new custom option before the "Custom..." option
      const customOptionIndex = Array.from(frequencySelector.options).findIndex(option => option.value === 'custom');
      frequencySelector.insertBefore(customOption, frequencySelector.options[customOptionIndex]);
      
      // Update the display
      renderExpenses();
      updateDashboard();
      
      // Hide the modal
      hideModal('custom-frequency-modal');
    });
  }
  
  // Close custom frequency modal button
  const closeFrequencyModalButton = document.getElementById('close-frequency-modal');
  if (closeFrequencyModalButton) {
    closeFrequencyModalButton.addEventListener('click', () => {
      hideModal('custom-frequency-modal');
      
      // Reset frequency selector to previous value
      const frequencySelector = document.getElementById('frequency-selector');
      frequencySelector.value = frequencySelector.options[0].value;
    });
  }
  
  // Cancel custom frequency button
  const cancelFrequencyButton = document.getElementById('cancel-frequency');
  if (cancelFrequencyButton) {
    cancelFrequencyButton.addEventListener('click', () => {
      hideModal('custom-frequency-modal');
      
      // Reset frequency selector to previous value
      const frequencySelector = document.getElementById('frequency-selector');
      frequencySelector.value = frequencySelector.options[0].value;
    });
  }
});
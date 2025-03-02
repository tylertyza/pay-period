// Expenses module for Pay Period Allocator

// Store expenses data
let expenses = [];
let categories = [];

// Load expenses
async function loadExpenses() {
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
  renderExpenses();
  
  // Update dashboard
  updateDashboard();
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
function renderExpenses() {
  const tableBody = document.getElementById('expenses-table-body');
  if (!tableBody) return;
  
  // Clear table
  tableBody.innerHTML = '';
  
  if (expenses.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="7" class="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm italic">
        No expenses found. Add an expense to get started.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Add expenses to table
  expenses.forEach(expense => {
    // Get account name
    const account = getAccountById(expense.account_id);
    const accountName = account ? account.name : 'None';
    
    // Get category name
    const category = getCategoryById(expense.category_id);
    const categoryName = category ? category.name : 'None';
    
    // Get split ratio
    const splitRatio = getSplitRatio(expense);
    const splitText = formatPercentage(splitRatio);
    
    // Convert amount to display frequency
    const displayAmount = convertAmount(
      expense.raw_amount,
      expense.raw_frequency,
      displayFrequency
    );
    
    const row = createTableRow(
      [
        expense.name,
        formatCurrency(displayAmount),
        getFrequencyDisplayName(displayFrequency),
        accountName,
        categoryName,
        splitText
      ],
      [
        createEditButton(() => editExpense(expense)),
        createDeleteButton(() => confirmDeleteExpense(expense))
      ]
    );
    
    tableBody.appendChild(row);
  });
}

// Get split ratio for current user
function getSplitRatio(expense) {
  if (!expense.expense_splits || expense.expense_splits.length === 0) {
    return 0.5; // Default to 50/50
  }
  
  const currentUserId = getCurrentUser()?.id;
  const userSplit = expense.expense_splits.find(split => split.user_id === currentUserId);
  
  return userSplit ? userSplit.ratio : 0.5;
}

// Get split type from expense splits
function getSplitType(expense) {
  if (!expense.expense_splits || expense.expense_splits.length === 0) {
    return 'equal'; // Default to equal split
  }
  
  const currentUserId = getCurrentUser()?.id;
  const userSplit = expense.expense_splits.find(split => split.user_id === currentUserId);
  
  if (expense.expense_splits.length === 1 && userSplit) {
    return 'me'; // Just me
  }
  
  // Check if all splits are equal
  const splitCount = expense.expense_splits.length;
  const expectedRatio = 1 / splitCount;
  const allEqual = expense.expense_splits.every(split => 
    Math.abs(split.ratio - expectedRatio) < 0.001
  );
  
  return allEqual ? 'equal' : 'custom';
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
  
  // Initialize split UI
  updateSplitUI(expenseSplitType.value);
  
  // Show modal
  showModal('expense-modal');
}

// Initialize split users
async function initializeSplitUsers() {
  // Get current user
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  // Get account owners if an account is selected
  const accountSelect = document.getElementById('expense-account');
  const accountId = accountSelect.value;
  
  if (accountId) {
    const account = getAccountById(accountId);
    if (account && account.owner_ids && account.owner_ids.length > 0) {
      await loadUsersForSplit(account.owner_ids);
      return;
    }
  }
  
  // Default to current user and partner if available
  const partner = await getPartnerUser();
  const splitUsers = [
    {
      id: currentUser.id,
      name: currentUser.profile?.name || 'Me',
      email: currentUser.email,
      ratio: partner ? 0.5 : 1.0
    }
  ];
  
  if (partner) {
    splitUsers.push({
      id: partner.id,
      name: partner.name,
      email: partner.email,
      ratio: 0.5
    });
  }
  
  renderSplitUsers(splitUsers);
}

// Load users for split
async function loadUsersForSplit(userIds) {
  if (!userIds || userIds.length === 0) {
    renderSplitUsers([]);
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
  
  // Calculate equal ratio
  const equalRatio = 1 / (data?.length || 1);
  
  // Add ratio to each user
  const splitUsers = (data || []).map(user => ({
    ...user,
    ratio: equalRatio
  }));
  
  renderSplitUsers(splitUsers);
}

// Load split users from expense
async function loadSplitUsers(expense) {
  if (!expense.expense_splits || expense.expense_splits.length === 0) {
    await initializeSplitUsers();
    return;
  }
  
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
  
  // Get split users
  const splitUsers = JSON.parse(container.dataset.splitUsers || '[]');
  
  // Clear container
  container.innerHTML = '';
  
  if (splitUsers.length === 0) {
    container.innerHTML = `
      <div class="text-sm text-gray-500 dark:text-gray-400 italic">
        No users available for splitting.
      </div>
    `;
    return;
  }
  
  if (splitType === 'equal') {
    // Equal split
    const equalRatio = 1 / splitUsers.length;
    
    splitUsers.forEach(user => {
      user.ratio = equalRatio;
      
      const userElement = document.createElement('div');
      userElement.className = 'flex items-center justify-between';
      userElement.innerHTML = `
        <div class="text-sm">${user.name}</div>
        <div class="text-sm font-medium">${Math.round(equalRatio * 100)}%</div>
      `;
      
      container.appendChild(userElement);
    });
  } else if (splitType === 'me') {
    // Just me
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Find current user in split users
    const meUser = splitUsers.find(user => user.id === currentUser.id);
    if (!meUser) return;
    
    // Set ratio to 1.0 for current user, 0 for others
    splitUsers.forEach(user => {
      user.ratio = user.id === currentUser.id ? 1.0 : 0.0;
    });
    
    const userElement = document.createElement('div');
    userElement.className = 'flex items-center justify-between';
    userElement.innerHTML = `
      <div class="text-sm">${meUser.name}</div>
      <div class="text-sm font-medium">100%</div>
    `;
    
    container.appendChild(userElement);
  } else if (splitType === 'custom') {
    // Custom split
    splitUsers.forEach(user => {
      const userElement = document.createElement('div');
      userElement.className = 'flex items-center space-x-2 mb-2';
      userElement.innerHTML = `
        <div class="text-sm flex-grow">${user.name}</div>
        <input type="number" 
               class="input w-20" 
               min="0" 
               max="100" 
               value="${Math.round(user.ratio * 100)}" 
               data-user-id="${user.id}">
        <div class="text-sm">%</div>
      `;
      
      // Add event listener to update ratios
      const input = userElement.querySelector('input');
      input.addEventListener('change', () => {
        updateCustomSplitRatios();
      });
      
      container.appendChild(userElement);
    });
  }
  
  // Update the data attribute with the updated users
  container.dataset.splitUsers = JSON.stringify(splitUsers);
}

// Update custom split ratios
function updateCustomSplitRatios() {
  const container = document.getElementById('expense-split-container');
  if (!container) return;
  
  // Get split users
  const splitUsers = JSON.parse(container.dataset.splitUsers || '[]');
  
  // Get all inputs
  const inputs = container.querySelectorAll('input[type="number"]');
  
  // Calculate total percentage
  let total = 0;
  inputs.forEach(input => {
    total += parseInt(input.value) || 0;
  });
  
  // Update ratios
  inputs.forEach(input => {
    const userId = input.dataset.userId;
    const percentage = parseInt(input.value) || 0;
    
    // Find user and update ratio
    const user = splitUsers.find(u => u.id === userId);
    if (user) {
      user.ratio = total > 0 ? percentage / 100 : 0;
    }
  });
  
  // Update the data attribute
  container.dataset.splitUsers = JSON.stringify(splitUsers);
  
  // Show warning if total is not 100%
  if (total !== 100) {
    alert(`Warning: The total split percentage is ${total}%, not 100%.`);
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
  
  if (!name) {
    alert('Please enter an expense name.');
    return;
  }
  
  if (isNaN(rawAmount) || rawAmount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }
  
  if (!rawFrequency) {
    alert('Please enter a frequency.');
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
        category_id: categoryId
      })
      .select();
  }
  
  const { data, error } = result;
  
  if (error) {
    console.error('Error saving expense:', error);
    alert(`Error saving expense: ${error.message}`);
    return;
  }
  
  // Get the expense ID (either from the form or from the newly created expense)
  let savedExpenseId = expenseId;
  
  if (!savedExpenseId && data) {
    // For new expenses, extract the ID from the response
    console.log('Expense save response data:', data);
    
    // Handle both array response and single object response
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
  
  // Delete existing splits for this expense
  const { error: deleteError } = await window.supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', expenseId);
  
  if (deleteError) {
    console.error('Error deleting existing expense splits:', deleteError);
    return;
  }
  
  console.log('Deleted existing expense splits for expense ID:', expenseId);
  
  // Filter out users with zero ratio
  const activeUsers = splitUsers.filter(user => user.ratio > 0);
  
  if (activeUsers.length === 0) {
    // If no active users, add current user with 100%
    const currentUser = getCurrentUser();
    if (currentUser) {
      activeUsers.push({
        id: currentUser.id,
        ratio: 1.0
      });
    }
  }
  
  // Create new splits
  const splits = activeUsers.map(user => ({
    expense_id: expenseId,
    user_id: user.id,
    ratio: user.ratio
  }));
  
  console.log('Creating new expense splits:', splits);
  
  const { data: splitsData, error: splitsError } = await window.supabase
    .from('expense_splits')
    .insert(splits)
    .select();
  
  if (splitsError) {
    console.error('Error creating expense splits:', splitsError);
    alert(`Error saving expense splits: ${splitsError.message}`);
    return;
  }
  
  console.log('Successfully created expense splits:', splitsData);
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
    alert(`Error deleting expense: ${error.message}`);
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
  return getExpensesByAccount(accountId).reduce((total, expense) => {
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, frequency);
    return total + amount;
  }, 0);
}

// Get total expenses amount for category
function getTotalExpensesAmountForCategory(categoryId, frequency = 'monthly') {
  return getExpensesByCategory(categoryId).reduce((total, expense) => {
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, frequency);
    return total + amount;
  }, 0);
}

// Get user's share of expenses
function getUserShareOfExpenses(frequency = 'monthly') {
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) return 0;
  
  return expenses.reduce((total, expense) => {
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, frequency);
    const splitRatio = getSplitRatio(expense);
    return total + (amount * splitRatio);
  }, 0);
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
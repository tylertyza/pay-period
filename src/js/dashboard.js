// Dashboard module for Pay Period Allocator

// Store the current view mode (monthly or biweekly)
let dashboardViewMode = 'monthly';

// Update dashboard
function updateDashboard() {
  updateSummary();
  updateAccountAllocations();
  updateExpenseCategories();
  updateSplitSummary();
}

// Toggle dashboard view mode between monthly and biweekly
function toggleDashboardViewMode() {
  // Toggle between monthly and biweekly
  dashboardViewMode = dashboardViewMode === 'monthly' ? 'biweekly' : 'monthly';
  
  // Update the frequency selector to match the dashboard view mode
  const frequencySelector = document.getElementById('frequency-selector');
  if (frequencySelector) {
    frequencySelector.value = dashboardViewMode === 'monthly' ? 'monthly' : 'biweekly';
    
    // Trigger the change event to update any listeners
    const event = new Event('change');
    frequencySelector.dispatchEvent(event);
  }
  
  // Update the dashboard
  updateDashboard();
  
  // Update toggle button text
  const toggleButton = document.getElementById('toggle-view-mode');
  if (toggleButton) {
    toggleButton.textContent = dashboardViewMode === 'monthly' 
      ? 'View Mode: Monthly' 
      : 'View Mode: Bi-Weekly';
  }
}

// Update summary
function updateSummary() {
  const totalIncomeElement = document.getElementById('total-income');
  const totalExpensesElement = document.getElementById('total-expenses');
  const netRemainingElement = document.getElementById('net-remaining');
  const summaryHeading = document.querySelector('.card h2');
  
  if (!totalIncomeElement || !totalExpensesElement || !netRemainingElement) return;
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Calculate totals
  const totalIncome = getTotalIncomeAmount(displayFrequency);
  const totalExpenses = getUserShareOfExpenses(displayFrequency);
  const netRemaining = totalIncome - totalExpenses;
  
  // Calculate bi-weekly amounts if needed
  const biweeklyFactor = parseFrequency('biweekly').factor / parseFrequency(displayFrequency).factor;
  const biweeklyIncome = totalIncome * biweeklyFactor;
  const biweeklyExpenses = totalExpenses * biweeklyFactor;
  const biweeklyNetRemaining = biweeklyIncome - biweeklyExpenses;
  
  // Update heading based on view mode
  if (summaryHeading) {
    summaryHeading.textContent = dashboardViewMode === 'monthly' 
      ? 'Monthly Summary' 
      : 'Bi-Weekly Summary';
  }
  
  // Update elements based on view mode
  if (dashboardViewMode === 'monthly') {
    // Apply income styling (always positive)
    totalIncomeElement.textContent = formatCurrency(totalIncome);
    totalIncomeElement.className = 'font-medium amount-positive';
    
    // Apply expenses styling (always shown as positive for clarity)
    totalExpensesElement.textContent = formatCurrency(totalExpenses);
    totalExpensesElement.className = 'font-medium';
    
    // Apply net remaining styling (can be positive or negative)
    netRemainingElement.textContent = formatCurrency(netRemaining);
    
    // Set color based on net remaining
    if (netRemaining < 0) {
      netRemainingElement.className = 'font-medium amount-negative';
    } else {
      netRemainingElement.className = 'font-medium amount-positive';
    }
  } else {
    // Bi-weekly view
    // Apply income styling (always positive)
    totalIncomeElement.textContent = formatCurrency(biweeklyIncome);
    totalIncomeElement.className = 'font-medium amount-positive';
    
    // Apply expenses styling (always shown as positive for clarity)
    totalExpensesElement.textContent = formatCurrency(biweeklyExpenses);
    totalExpensesElement.className = 'font-medium';
    
    // Apply net remaining styling (can be positive or negative)
    netRemainingElement.textContent = formatCurrency(biweeklyNetRemaining);
    
    // Set color based on net remaining
    if (biweeklyNetRemaining < 0) {
      netRemainingElement.className = 'font-medium amount-negative';
    } else {
      netRemainingElement.className = 'font-medium amount-positive';
    }
  }
  
  // Add a note that this is the user's share
  const expensesLabelElement = document.querySelector('[data-label="total-expenses"]');
  if (expensesLabelElement) {
    expensesLabelElement.textContent = "Your Share of Expenses:";
  }
}

// Update account allocations
function updateAccountAllocations() {
  const accountAllocationsElement = document.getElementById('account-allocations');
  const accountAllocationsHeading = document.querySelector('.card:nth-child(2) h2');
  
  if (!accountAllocationsElement) return;
  
  // Update heading based on view mode
  if (accountAllocationsHeading) {
    accountAllocationsHeading.textContent = dashboardViewMode === 'monthly' 
      ? 'Monthly Account Allocations' 
      : 'Bi-Weekly Account Allocations';
  }
  
  // Clear content
  accountAllocationsElement.innerHTML = '';
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Check if there are any accounts
  if (!accounts || accounts.length === 0) {
    accountAllocationsElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No accounts found. Add accounts to see allocations.
      </div>
    `;
    return;
  }
  
  // Add a heading to clarify these are your allocations
  const headingDiv = document.createElement('div');
  headingDiv.className = 'mb-3 text-sm font-medium text-gray-600 dark:text-gray-400';
  headingDiv.textContent = 'Your share to set aside:';
  accountAllocationsElement.appendChild(headingDiv);
  
  // Create account allocations
  let totalAllocation = 0;
  const accountItems = [];
  
  // Calculate bi-weekly factor if needed
  const biweeklyFactor = parseFrequency('biweekly').factor / parseFrequency(displayFrequency).factor;
  
  // Define account type colors
  const accountTypeColors = {
    'checking': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    'savings': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    'credit': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    'investment': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    'other': 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
  };
  
  accounts.forEach(account => {
    const monthlyForAccount = getTotalExpensesAmountForAccount(account.id, displayFrequency);
    
    if (monthlyForAccount <= 0) return; // Skip accounts with no expenses
    
    // Calculate amount based on view mode
    const amountToShow = dashboardViewMode === 'monthly' 
      ? monthlyForAccount 
      : monthlyForAccount * biweeklyFactor;
    
    totalAllocation += amountToShow;
    
    // Get account type color
    const accountTypeColor = accountTypeColors[account.type] || accountTypeColors.other;
    
    const accountItem = document.createElement('div');
    accountItem.className = 'flex justify-between items-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-800';
    
    // Create account name with type indicator
    const accountNameSpan = document.createElement('div');
    accountNameSpan.className = 'flex items-center';
    accountNameSpan.innerHTML = `
      <span class="inline-block w-2 h-2 rounded-full mr-2 ${accountTypeColor.split(' ')[0]}"></span>
      <span class="text-gray-700 dark:text-gray-300">${account.name}</span>
      <span class="ml-2 text-xs px-1.5 py-0.5 rounded ${accountTypeColor}">${account.type.charAt(0).toUpperCase() + account.type.slice(1)}</span>
    `;
    
    // Create amount span
    const amountSpan = document.createElement('span');
    amountSpan.className = 'font-medium';
    amountSpan.textContent = formatCurrency(amountToShow);
    
    accountItem.appendChild(accountNameSpan);
    accountItem.appendChild(amountSpan);
    
    accountItems.push({
      element: accountItem,
      account: account,
      amount: amountToShow
    });
  });
  
  // If no accounts have expenses
  if (accountItems.length === 0) {
    accountAllocationsElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No expenses allocated to accounts yet.
      </div>
    `;
    return;
  }
  
  // Add account items to the DOM
  accountItems.forEach(item => {
    accountAllocationsElement.appendChild(item.element);
  });
  
  // Add total allocation
  const totalDiv = document.createElement('div');
  totalDiv.className = 'flex justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-700';
  totalDiv.innerHTML = `
    <span class="font-medium text-gray-700 dark:text-gray-300">Total:</span>
    <span class="font-medium">${formatCurrency(totalAllocation)}</span>
  `;
  accountAllocationsElement.appendChild(totalDiv);
}

// Update expense categories
function updateExpenseCategories() {
  const expenseCategoriesElement = document.getElementById('expense-categories');
  const expenseCategoriesHeading = document.querySelector('.card:nth-child(3) h2');
  
  if (!expenseCategoriesElement) return;
  
  // Update heading based on view mode
  if (expenseCategoriesHeading) {
    expenseCategoriesHeading.textContent = dashboardViewMode === 'monthly' 
      ? 'Monthly Expense Categories' 
      : 'Bi-Weekly Expense Categories';
  }
  
  // Clear content
  expenseCategoriesElement.innerHTML = '';
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Check if there are any categories
  if (!categories || categories.length === 0) {
    expenseCategoriesElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No categories found. Add categories to see expenses by category.
      </div>
    `;
    return;
  }
  
  // Add a heading to clarify these are your expenses
  const headingDiv = document.createElement('div');
  headingDiv.className = 'mb-3 text-sm font-medium text-gray-600 dark:text-gray-400';
  headingDiv.textContent = 'Your share by category:';
  expenseCategoriesElement.appendChild(headingDiv);
  
  // Create category expenses
  let totalExpenses = 0;
  const categoryItems = [];
  
  // Calculate bi-weekly factor if needed
  const biweeklyFactor = parseFrequency('biweekly').factor / parseFrequency(displayFrequency).factor;
  
  // Map category names to our predefined classes
  const categoryMap = {
    'housing': { class: 'category-tag-housing', icon: '🏠' },
    'rent': { class: 'category-tag-housing', icon: '🏠' },
    'mortgage': { class: 'category-tag-housing', icon: '🏠' },
    'food': { class: 'category-tag-food', icon: '🍽️' },
    'groceries': { class: 'category-tag-food', icon: '🛒' },
    'dining': { class: 'category-tag-food', icon: '🍽️' },
    'transportation': { class: 'category-tag-transportation', icon: '🚗' },
    'car': { class: 'category-tag-transportation', icon: '🚗' },
    'gas': { class: 'category-tag-transportation', icon: '⛽' },
    'utilities': { class: 'category-tag-utilities', icon: '💡' },
    'electric': { class: 'category-tag-utilities', icon: '💡' },
    'water': { class: 'category-tag-utilities', icon: '💧' },
    'internet': { class: 'category-tag-utilities', icon: '🌐' },
    'entertainment': { class: 'category-tag-entertainment', icon: '🎬' },
    'streaming': { class: 'category-tag-entertainment', icon: '📺' },
    'health': { class: 'category-tag-health', icon: '🏥' },
    'medical': { class: 'category-tag-health', icon: '🏥' },
    'insurance': { class: 'category-tag-health', icon: '🛡️' }
  };
  
  categories.forEach(category => {
    const monthlyForCategory = getTotalExpensesAmountForCategory(category.id, displayFrequency);
    
    if (monthlyForCategory <= 0) return; // Skip categories with no expenses
    
    // Calculate amount based on view mode
    const amountToShow = dashboardViewMode === 'monthly' 
      ? monthlyForCategory 
      : monthlyForCategory * biweeklyFactor;
    
    totalExpenses += amountToShow;
    
    // Find the appropriate category class and icon
    const categorySlug = category.name.toLowerCase().replace(/\s+/g, '-');
    let categoryClass = 'category-tag-other';
    let categoryIcon = '📋';
    
    for (const [key, value] of Object.entries(categoryMap)) {
      if (categorySlug.includes(key)) {
        categoryClass = value.class;
        categoryIcon = value.icon;
        break;
      }
    }
    
    const categoryItem = document.createElement('div');
    categoryItem.className = 'flex justify-between items-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-800';
    
    // Create category name with icon
    const categoryNameSpan = document.createElement('div');
    categoryNameSpan.className = 'flex items-center';
    
    // Create category tag
    const categoryTag = document.createElement('span');
    categoryTag.className = `category-tag ${categoryClass} mr-2`;
    categoryTag.innerHTML = `${categoryIcon} ${category.name}`;
    
    categoryNameSpan.appendChild(categoryTag);
    
    // Create amount span with percentage
    const amountSpan = document.createElement('span');
    amountSpan.className = 'font-medium';
    
    // Calculate percentage of total expenses
    const totalUserExpenses = getUserShareOfExpenses(displayFrequency);
    const adjustedTotal = dashboardViewMode === 'monthly' 
      ? totalUserExpenses 
      : totalUserExpenses * biweeklyFactor;
    
    const percentage = adjustedTotal > 0 ? (amountToShow / adjustedTotal) * 100 : 0;
    
    amountSpan.innerHTML = `
      ${formatCurrency(amountToShow)}
      <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(${percentage.toFixed(1)}%)</span>
    `;
    
    categoryItem.appendChild(categoryNameSpan);
    categoryItem.appendChild(amountSpan);
    
    categoryItems.push({
      element: categoryItem,
      category: category,
      amount: amountToShow,
      percentage: percentage
    });
  });
  
  // If no categories have expenses
  if (categoryItems.length === 0) {
    expenseCategoriesElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No expenses categorized yet.
      </div>
    `;
    return;
  }
  
  // Sort categories by amount (descending)
  categoryItems.sort((a, b) => b.amount - a.amount);
  
  // Add category items to the DOM
  categoryItems.forEach(item => {
    expenseCategoriesElement.appendChild(item.element);
  });
  
  // Add total expenses
  const totalDiv = document.createElement('div');
  totalDiv.className = 'flex justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-700';
  totalDiv.innerHTML = `
    <span class="font-medium text-gray-700 dark:text-gray-300">Total:</span>
    <span class="font-medium">${formatCurrency(totalExpenses)}</span>
  `;
  expenseCategoriesElement.appendChild(totalDiv);
}

// Update split summary
function updateSplitSummary() {
  const splitSummaryElement = document.getElementById('split-summary');
  const splitSummaryHeading = document.querySelector('.card:nth-child(4) h2');
  
  if (!splitSummaryElement) return;
  
  // Update heading based on view mode
  if (splitSummaryHeading) {
    splitSummaryHeading.textContent = dashboardViewMode === 'monthly' 
      ? 'Monthly Split Summary' 
      : 'Bi-Weekly Split Summary';
  }
  
  // Clear content
  splitSummaryElement.innerHTML = '';
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Check if there are any expenses
  if (!expenses || expenses.length === 0) {
    splitSummaryElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No expenses found. Add expenses to see split summary.
      </div>
    `;
    return;
  }
  
  // Get all users involved in expense splits
  const userSplits = {};
  let totalExpenses = 0;
  
  // Calculate bi-weekly factor if needed
  const biweeklyFactor = parseFrequency('biweekly').factor / parseFrequency(displayFrequency).factor;
  
  // Calculate each user's share
  expenses.forEach(expense => {
    const monthlyAmount = convertAmount(expense.raw_amount, expense.raw_frequency, displayFrequency);
    
    // Calculate amount based on view mode
    const amountToShow = dashboardViewMode === 'monthly' 
      ? monthlyAmount 
      : monthlyAmount * biweeklyFactor;
    
    totalExpenses += amountToShow;
    
    if (expense.expense_splits && expense.expense_splits.length > 0) {
      // Only include splits with non-zero ratios
      const nonZeroSplits = expense.expense_splits.filter(split => split.ratio > 0.001);
      
      nonZeroSplits.forEach(split => {
        const userShare = amountToShow * split.ratio;
        
        if (!userSplits[split.user_id]) {
          userSplits[split.user_id] = {
            userId: split.user_id,
            amount: 0,
            name: null
          };
        }
        
        userSplits[split.user_id].amount += userShare;
      });
    }
  });
  
  // Get user details for all users in splits
  const userIds = Object.keys(userSplits);
  
  // If no users found, show message
  if (userIds.length === 0) {
    splitSummaryElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No expense splits found.
      </div>
    `;
    return;
  }
  
  // Get current user
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id;
  
  // Sort users to put current user first
  const sortedUserIds = userIds.sort((a, b) => {
    if (a === currentUserId) return -1;
    if (b === currentUserId) return 1;
    return 0;
  });
  
  // Load user names and update the UI
  loadUserNames(userSplits).then(() => {
    updateSplitSummaryWithNames(splitSummaryElement, userSplits, sortedUserIds, totalExpenses, displayFrequency);
  });
}

// Load user names for the split summary
async function loadUserNames(userSplits) {
  const userIds = Object.keys(userSplits);
  
  if (userIds.length === 0) return;
  
  // Fetch user details
  const { data, error } = await window.supabase
    .from('users')
    .select('id, name')
    .in('id', userIds);
  
  if (error) {
    console.error('Error loading user names:', error);
    return;
  }
  
  // Update user splits with names
  if (data) {
    data.forEach(user => {
      if (userSplits[user.id]) {
        userSplits[user.id].name = user.name;
      }
    });
  }
}

// Update split summary with user names
function updateSplitSummaryWithNames(element, userSplits, sortedUserIds, totalExpenses, displayFrequency) {
  if (!element) return;
  
  // Clear content
  element.innerHTML = '';
  
  // Get current user
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id;
  
  // Add a heading to clarify this is the split summary
  const headingDiv = document.createElement('div');
  headingDiv.className = 'mb-3 text-sm font-medium text-gray-600 dark:text-gray-400 split-summary-heading';
  headingDiv.textContent = 'How expenses are shared:';
  element.appendChild(headingDiv);
  
  // Create split summary items
  sortedUserIds.forEach(userId => {
    const split = userSplits[userId];
    const isCurrentUser = userId === currentUserId;
    
    // Get user name
    let userName = isCurrentUser ? 'Your share' : (split.name || 'Other user');
    
    const userItem = document.createElement('div');
    userItem.className = 'flex justify-between items-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-800 split-summary-item';
    
    // Create user avatar and name
    const userNameSpan = document.createElement('div');
    userNameSpan.className = 'flex items-center';
    
    // Create user avatar
    const userAvatar = document.createElement('span');
    userAvatar.className = `inline-flex items-center justify-center w-8 h-8 rounded-full mr-2 ${isCurrentUser ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 split-avatar-current' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 split-avatar-other'}`;
    
    // Get initials for avatar
    const initials = userName.split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
    
    userAvatar.textContent = initials;
    
    // Create user name element
    const nameElement = document.createElement('span');
    nameElement.className = `${isCurrentUser ? 'font-medium text-primary-700 dark:text-primary-400 split-name-current' : 'text-gray-700 dark:text-gray-300 split-name-other'}`;
    nameElement.textContent = userName;
    
    userNameSpan.appendChild(userAvatar);
    userNameSpan.appendChild(nameElement);
    
    // Create amount span with percentage
    const amountSpan = document.createElement('span');
    amountSpan.className = 'font-medium split-amount';
    
    // Calculate percentage of total expenses
    const percentage = totalExpenses > 0 ? (split.amount / totalExpenses) * 100 : 0;
    
    amountSpan.innerHTML = `
      ${formatCurrency(split.amount)}
      <span class="text-xs text-gray-500 dark:text-gray-400 ml-1 split-percentage">(${percentage.toFixed(1)}%)</span>
    `;
    
    userItem.appendChild(userNameSpan);
    userItem.appendChild(amountSpan);
    
    element.appendChild(userItem);
  });
  
  // Add percentage breakdown with visual bar
  if (totalExpenses > 0 && sortedUserIds.length > 1) {
    const percentageContainer = document.createElement('div');
    percentageContainer.className = 'mt-4 split-visual-container';
    
    // Add a label for the visualization
    const visualLabel = document.createElement('div');
    visualLabel.className = 'text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 split-visual-label';
    visualLabel.textContent = 'Visual breakdown:';
    percentageContainer.appendChild(visualLabel);
    
    // Create the visual bar
    const visualBar = document.createElement('div');
    visualBar.className = 'h-4 w-full rounded-full overflow-hidden flex split-visual-bar';
    
    // Define colors for different users
    const colors = [
      'bg-primary-500 dark:bg-primary-600 split-bar-segment-0',
      'bg-cyan-500 dark:bg-cyan-600 split-bar-segment-1',
      'bg-amber-500 dark:bg-amber-600 split-bar-segment-2',
      'bg-purple-500 dark:bg-purple-600 split-bar-segment-3',
      'bg-green-500 dark:bg-green-600 split-bar-segment-4',
      'bg-red-500 dark:bg-red-600 split-bar-segment-5'
    ];
    
    // Create segments for each user
    sortedUserIds.forEach((userId, index) => {
      const split = userSplits[userId];
      const percentage = (split.amount / totalExpenses) * 100;
      const colorIndex = index % colors.length;
      
      const segment = document.createElement('div');
      segment.className = `${colors[colorIndex]} split-bar-segment`;
      segment.style.width = `${percentage}%`;
      segment.title = `${split.name || 'User'}: ${percentage.toFixed(1)}%`;
      
      visualBar.appendChild(segment);
    });
    
    percentageContainer.appendChild(visualBar);
    
    // Add a legend
    const legend = document.createElement('div');
    legend.className = 'flex flex-wrap mt-2 gap-2 split-legend';
    
    sortedUserIds.forEach((userId, index) => {
      const split = userSplits[userId];
      const isCurrentUser = userId === currentUserId;
      const colorIndex = index % colors.length;
      
      const legendItem = document.createElement('div');
      legendItem.className = 'flex items-center text-xs split-legend-item';
      
      const colorDot = document.createElement('span');
      colorDot.className = `inline-block w-3 h-3 rounded-full mr-1 ${colors[colorIndex].split(' ')[0]} split-legend-dot`;
      
      const nameSpan = document.createElement('span');
      nameSpan.className = `${isCurrentUser ? 'font-medium split-legend-current' : 'split-legend-other'}`;
      nameSpan.textContent = isCurrentUser ? 'You' : (split.name || 'Other user');
      
      legendItem.appendChild(colorDot);
      legendItem.appendChild(nameSpan);
      
      legend.appendChild(legendItem);
    });
    
    percentageContainer.appendChild(legend);
    element.appendChild(percentageContainer);
  }
  
  // Add total amount
  const totalDiv = document.createElement('div');
  totalDiv.className = 'flex justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 split-total';
  totalDiv.innerHTML = `
    <span class="font-medium text-gray-700 dark:text-gray-300 split-total-label">Total:</span>
    <span class="font-medium split-total-amount">${formatCurrency(totalExpenses)}</span>
  `;
  element.appendChild(totalDiv);
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize dashboard view mode based on frequency selector
  const frequencySelector = document.getElementById('frequency-selector');
  if (frequencySelector) {
    // Set initial dashboard view mode based on frequency selector
    dashboardViewMode = frequencySelector.value === 'monthly' ? 'monthly' : 'biweekly';
    
    // Update toggle button text
    const toggleButton = document.getElementById('toggle-view-mode');
    if (toggleButton) {
      toggleButton.textContent = dashboardViewMode === 'monthly' 
        ? 'View Mode: Monthly' 
        : 'View Mode: Bi-Weekly';
    }
    
    // Listen for changes to the frequency selector
    frequencySelector.addEventListener('change', () => {
      // Update dashboard view mode based on frequency selector
      dashboardViewMode = frequencySelector.value === 'monthly' ? 'monthly' : 'biweekly';
      
      // Update toggle button text
      const toggleButton = document.getElementById('toggle-view-mode');
      if (toggleButton) {
        toggleButton.textContent = dashboardViewMode === 'monthly' 
          ? 'View Mode: Monthly' 
          : 'View Mode: Bi-Weekly';
      }
      
      // Update dashboard
      updateDashboard();
    });
  }
  
  // Toggle view mode button
  const toggleViewModeButton = document.getElementById('toggle-view-mode');
  if (toggleViewModeButton) {
    toggleViewModeButton.addEventListener('click', toggleDashboardViewMode);
  }
}); 
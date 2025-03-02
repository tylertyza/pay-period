// Dashboard module for Pay Period Allocator

// Update dashboard
function updateDashboard() {
  updateSummary();
  updateAccountAllocations();
  updateExpenseCategories();
  updateSplitSummary();
}

// Update summary
function updateSummary() {
  const totalIncomeElement = document.getElementById('total-income');
  const totalExpensesElement = document.getElementById('total-expenses');
  const netRemainingElement = document.getElementById('net-remaining');
  
  if (!totalIncomeElement || !totalExpensesElement || !netRemainingElement) return;
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Calculate totals
  const totalIncome = getTotalIncomeAmount(displayFrequency);
  const totalExpenses = getTotalExpensesAmount(displayFrequency);
  const netRemaining = totalIncome - totalExpenses;
  
  // Update elements
  totalIncomeElement.textContent = formatCurrency(totalIncome);
  totalExpensesElement.textContent = formatCurrency(totalExpenses);
  netRemainingElement.textContent = formatCurrency(netRemaining);
  
  // Set color based on net remaining
  if (netRemaining < 0) {
    netRemainingElement.classList.remove('text-green-500');
    netRemainingElement.classList.add('text-red-500');
  } else {
    netRemainingElement.classList.remove('text-red-500');
    netRemainingElement.classList.add('text-green-500');
  }
}

// Update account allocations
function updateAccountAllocations() {
  const accountAllocationsElement = document.getElementById('account-allocations');
  if (!accountAllocationsElement) return;
  
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
  
  // Create account allocations
  accounts.forEach(account => {
    const totalForAccount = getTotalExpensesAmountForAccount(account.id, displayFrequency);
    
    if (totalForAccount <= 0) return; // Skip accounts with no expenses
    
    const accountItem = document.createElement('div');
    accountItem.className = 'flex justify-between';
    accountItem.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">${account.name}:</span>
      <span class="font-medium">${formatCurrency(totalForAccount)}</span>
    `;
    
    accountAllocationsElement.appendChild(accountItem);
  });
  
  // If no accounts have expenses
  if (accountAllocationsElement.children.length === 0) {
    accountAllocationsElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No expenses allocated to accounts yet.
      </div>
    `;
  }
}

// Update expense categories
function updateExpenseCategories() {
  const expenseCategoriesElement = document.getElementById('expense-categories');
  if (!expenseCategoriesElement) return;
  
  // Clear content
  expenseCategoriesElement.innerHTML = '';
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Check if there are any categories
  if (!categories || categories.length === 0) {
    expenseCategoriesElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No categories found. Add expenses with categories to see breakdown.
      </div>
    `;
    return;
  }
  
  // Create category breakdown
  categories.forEach(category => {
    const totalForCategory = getTotalExpensesAmountForCategory(category.id, displayFrequency);
    
    if (totalForCategory <= 0) return; // Skip categories with no expenses
    
    const categoryItem = document.createElement('div');
    categoryItem.className = 'flex justify-between';
    categoryItem.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">${category.name}:</span>
      <span class="font-medium">${formatCurrency(totalForCategory)}</span>
    `;
    
    expenseCategoriesElement.appendChild(categoryItem);
  });
  
  // If no categories have expenses
  if (expenseCategoriesElement.children.length === 0) {
    expenseCategoriesElement.innerHTML = `
      <div class="text-gray-500 dark:text-gray-400 text-sm italic">
        No expenses assigned to categories yet.
      </div>
    `;
  }
}

// Update split summary
function updateSplitSummary() {
  const splitSummaryElement = document.getElementById('split-summary');
  if (!splitSummaryElement) return;
  
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
  
  // Calculate each user's share
  expenses.forEach(expense => {
    const amount = convertAmount(expense.raw_amount, expense.raw_frequency, displayFrequency);
    totalExpenses += amount;
    
    if (expense.expense_splits && expense.expense_splits.length > 0) {
      expense.expense_splits.forEach(split => {
        const userShare = amount * split.ratio;
        
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
  
  // Create split summary items
  sortedUserIds.forEach(userId => {
    const split = userSplits[userId];
    const isCurrentUser = userId === currentUserId;
    
    // Get user name
    let userName = isCurrentUser ? 'Your share' : 'Other user';
    if (split.name) {
      userName = isCurrentUser ? 'Your share' : `${split.name}'s share`;
    }
    
    const userItem = document.createElement('div');
    userItem.className = 'flex justify-between';
    userItem.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">${userName}:</span>
      <span class="font-medium">${formatCurrency(split.amount)}</span>
    `;
    splitSummaryElement.appendChild(userItem);
  });
  
  // Add percentage breakdown
  if (totalExpenses > 0) {
    const percentageItem = document.createElement('div');
    percentageItem.className = 'flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700';
    
    let percentageText = '';
    sortedUserIds.forEach((userId, index) => {
      const split = userSplits[userId];
      const percentage = (split.amount / totalExpenses) * 100;
      
      if (index > 0) percentageText += ' / ';
      percentageText += `${Math.round(percentage)}%`;
    });
    
    percentageItem.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">Split ratio:</span>
      <span class="font-medium">${percentageText}</span>
    `;
    splitSummaryElement.appendChild(percentageItem);
  }
  
  // Load user names asynchronously
  loadUserNames(userSplits).then(() => {
    // Update the display with user names
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
  
  // Create split summary items
  sortedUserIds.forEach(userId => {
    const split = userSplits[userId];
    const isCurrentUser = userId === currentUserId;
    
    // Get user name
    let userName = isCurrentUser ? 'Your share' : (split.name || 'Other user');
    
    const userItem = document.createElement('div');
    userItem.className = 'flex justify-between';
    userItem.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">${userName}:</span>
      <span class="font-medium">${formatCurrency(split.amount)}</span>
    `;
    element.appendChild(userItem);
  });
  
  // Add percentage breakdown
  if (totalExpenses > 0) {
    const percentageItem = document.createElement('div');
    percentageItem.className = 'flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700';
    
    let percentageText = '';
    sortedUserIds.forEach((userId, index) => {
      const split = userSplits[userId];
      const percentage = (split.amount / totalExpenses) * 100;
      
      if (index > 0) percentageText += ' / ';
      percentageText += `${Math.round(percentage)}%`;
    });
    
    percentageItem.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">Split ratio:</span>
      <span class="font-medium">${percentageText}</span>
    `;
    element.appendChild(percentageItem);
  }
} 
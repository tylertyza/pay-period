// Notifications module for Pay Period Allocator

// Store notifications data
let splitSuggestions = [];
let lastNotificationIds = new Set(); // Track IDs of suggestions we've already notified about

// Polling timer for notifications
let notificationsPollingTimer = null;

// Load notifications
async function loadNotifications() {
  console.log('Loading notifications...');
  
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser || !currentUser.user) {
      console.error('No user logged in');
      return;
    }
    
    const userId = currentUser.user.id;
    console.log('Current user ID:', userId);
    
    // Query the split_suggestions table for pending suggestions for this user
    const { data: suggestions, error } = await supabase
      .from('split_suggestions')
      .select(`
        *,
        expenses(*),
        from_user:users!from_user_id(id, name, email)
      `)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading notifications:', error);
      return;
    }
    
    console.log('Loaded notifications:', suggestions);
    
    // Check for new suggestions that we haven't notified about yet
    const currentIds = new Set(splitSuggestions.map(s => s.id));
    const newSuggestions = suggestions.filter(s => !currentIds.has(s.id) && !lastNotificationIds.has(s.id));
    
    // Update the stored suggestions
    splitSuggestions = suggestions || [];
    
    // Update the notifications count
    updateNotificationsCount(splitSuggestions.length);
    
    // Render the notifications
    renderNotifications(splitSuggestions);
    
    // Show notifications for new suggestions
    if (newSuggestions.length > 0) {
      console.log('New suggestions found:', newSuggestions);
      
      // Force update expenses to show pending suggestions
      if (typeof loadExpenses === 'function') {
        loadExpenses();
      }
      
      // Show a notification for each new suggestion
      newSuggestions.forEach(suggestion => {
        const expenseName = suggestion.expenses?.name || 'Expense';
        const amount = formatCurrency(suggestion.suggested_amount);
        
        // Show browser notification
        showBrowserNotification(
          'New Split Suggestion', 
          `You have a new expense split suggestion for ${expenseName}: ${amount}`
        );
        
        // Add to the set of notified IDs
        lastNotificationIds.add(suggestion.id);
      });
    } else {
      console.log('No new suggestions found');
    }
    
    return splitSuggestions;
  } catch (error) {
    console.error('Exception loading notifications:', error);
    return [];
  }
}

// Update the notifications count in the UI
function updateNotificationsCount(count) {
  console.log('Updating notifications count:', count);
  
  const countElement = document.getElementById('suggestions-indicator');
  if (countElement) {
    countElement.textContent = count;
    
    // Show/hide the count based on whether there are notifications
    if (count > 0) {
      console.log('Showing notification indicator');
      countElement.classList.remove('hidden');
    } else {
      console.log('Hiding notification indicator');
      countElement.classList.add('hidden');
    }
  } else {
    console.error('Could not find suggestions-indicator element');
  }
}

// Render notifications in the UI
function renderNotifications(suggestions) {
  const container = document.getElementById('split-suggestions-container');
  if (!container) return;
  
  // Clear existing content
  container.innerHTML = '';
  
  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = `
    `;
    return;
  }
  
  // Create a card for each suggestion
  suggestions.forEach(async suggestion => {
    const expense = suggestion.expenses;
    // Handle missing profile information
    let suggesterName = "Someone";
    
    // Try to get the suggester's name if from_user is available
    if (suggestion.from_user) {
      suggesterName = suggestion.from_user.name;
    }
    
    // Get category name if category_id exists
    let categoryName = 'Uncategorized';
    if (expense.category_id) {
      try {
        const { data: category } = await supabase
          .from('categories')
          .select('name')
          .eq('id', expense.category_id)
          .single();
        
        if (category) {
          categoryName = category.name;
        }
      } catch (error) {
        console.error('Error fetching category:', error);
      }
    }
    
    const card = document.createElement('div');
    card.className = 'card mb-4 border border-gray-200 dark:border-dark-400 shadow-sm hover:shadow-md transition-shadow duration-200';
    card.innerHTML = `
      <div class="flex flex-col space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-semibold text-lg">${expense.name}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              ${getFrequencyDisplayName(expense.raw_frequency)} • ${categoryName}
            </p>
          </div>
          <div class="text-right">
            <span class="text-sm text-gray-500 dark:text-gray-400">
              ${formatTimeAgo(suggestion.created_at)}
            </span>
          </div>
        </div>
        
        <div class="bg-gray-50 dark:bg-dark-300 p-3 rounded-md">
          <p class="text-sm">
            <span class="font-medium">${suggesterName}</span> suggests you pay 
            <span class="font-medium text-primary-600 dark:text-primary-400">${formatCurrency(suggestion.suggested_amount)}</span> 
            of the total <span class="font-medium">${formatCurrency(expense.raw_amount)}</span>
            <span class="text-gray-600 dark:text-gray-400">(${formatPercentage(suggestion.suggested_ratio)} of the expense)</span>
          </p>
        </div>
        
        <div class="flex space-x-3 mt-2">
          <button class="btn btn-primary btn-sm accept-suggestion flex-1" data-id="${suggestion.id}">
            Accept
          </button>
          <button class="btn btn-secondary btn-sm reject-suggestion flex-1" data-id="${suggestion.id}">
            Reject
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(card);
    
    // Add event listeners for accept and reject buttons
    card.querySelector('.accept-suggestion').addEventListener('click', () => {
      acceptSplitSuggestion(suggestion.id, suggestion.expense_id, suggestion.suggested_amount);
    });
    
    card.querySelector('.reject-suggestion').addEventListener('click', () => {
      rejectSplitSuggestion(suggestion.id);
    });
  });
}

// Format a date string as a relative time (e.g. "2 hours ago")
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  // Time intervals in seconds
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };
  
  let counter;
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    counter = Math.floor(seconds / secondsInUnit);
    if (counter > 0) {
      if (counter === 1) {
        return `1 ${unit} ago`;
      } else {
        return `${counter} ${unit}s ago`;
      }
    }
  }
  
  return 'just now';
}

// Accept a split suggestion
async function acceptSplitSuggestion(suggestionId, expenseId, amount) {
  console.log(`Accepting suggestion ${suggestionId} for expense ${expenseId} with amount ${amount}`);
  
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser || !currentUser.user) {
      console.error('No user logged in');
      return;
    }
    
    const userId = currentUser.user.id;
    
    // Get the suggestion to get the ratio
    const { data: suggestion, error: suggestionError } = await supabase
      .from('split_suggestions')
      .select('suggested_ratio, expense_id')
      .eq('id', suggestionId)
      .single();
    
    if (suggestionError) {
      console.error('Error getting suggestion:', suggestionError);
      // Keep this error alert as it's a real error
      console.error('Failed to get the suggestion details. Please try again.');
      return;
    }
    
    // Make sure we have the correct expense ID
    expenseId = suggestion.expense_id || expenseId;
    
    // Check if there's already a split for this user and expense
    const { data: existingSplits, error: existingSplitsError } = await supabase
      .from('expense_splits')
      .select('id')
      .eq('expense_id', expenseId)
      .eq('user_id', userId);
    
    if (existingSplitsError) {
      console.error('Error checking existing splits:', existingSplitsError);
    } else if (existingSplits && existingSplits.length > 0) {
      // Delete existing splits for this user and expense
      console.log('Deleting existing splits for this user and expense');
      const { error: deleteError } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId)
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('Error deleting existing splits:', deleteError);
      }
    }
    
    // Start a transaction by using multiple operations
    
    // 1. Update the suggestion status to 'accepted'
    const { error: updateError } = await supabase
      .from('split_suggestions')
      .update({ status: 'accepted' })
      .eq('id', suggestionId);
    
    if (updateError) {
      console.error('Error updating suggestion status:', updateError);
      // Keep this error alert as it's a real error
      console.error('Failed to accept the suggestion. Please try again.');
      return;
    }
    
    // 2. Create a new expense_split record
    const { error: splitError } = await supabase
      .from('expense_splits')
      .insert({
        expense_id: expenseId,
        user_id: userId,
        ratio: suggestion.suggested_ratio
      });
    
    if (splitError) {
      console.error('Error creating expense split:', splitError);
      // Keep this error alert as it's a real error
      console.error('Failed to create the expense split. Please try again.');
      return;
    }
    
    // Reload notifications and expenses after successful acceptance
    await loadNotifications();
    if (typeof loadExpenses === 'function') {
      await loadExpenses();
    }
    
    // Update dashboard
    if (typeof updateDashboard === 'function') {
      updateDashboard();
    }
    
  } catch (error) {
    console.error('Exception accepting split suggestion:', error);
    // Keep this error alert as it's a real error
    console.error('An error occurred while accepting the suggestion. Please try again.');
  }
}

// Reject a split suggestion
async function rejectSplitSuggestion(suggestionId) {
  console.log(`Rejecting suggestion ${suggestionId}`);
  
  try {
    // Update the suggestion status to 'rejected'
    const { error } = await supabase
      .from('split_suggestions')
      .update({ status: 'rejected' })
      .eq('id', suggestionId);
    
    if (error) {
      console.error('Error rejecting suggestion:', error);
      // Keep this error alert as it's a real error
      console.error('Failed to reject the suggestion. Please try again.');
      return;
    }
    
    // Reload notifications and expenses after successful rejection
    loadNotifications();
    if (typeof loadExpenses === 'function') {
      loadExpenses();
    }
    
  } catch (error) {
    console.error('Error in rejectSplitSuggestion:', error);
    // Keep this error alert as it's a real error
    console.error('An error occurred while rejecting the suggestion.');
  }
}

// Set up real-time subscription for notifications
async function setupNotificationsSubscription() {
  console.log('Setting up notifications subscription...');
  
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser || !currentUser.user) {
      console.error('No user logged in, cannot set up notifications subscription');
      return;
    }
    
    const userId = currentUser.user.id;
    console.log('Setting up subscription for user:', userId);
    
    // Subscribe to changes in the split_suggestions table
    const subscription = supabase
      .channel('split_suggestions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'split_suggestions',
          filter: `to_user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Received real-time notification:', payload);
          
          // Reload notifications
          loadNotifications();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });
    
    console.log('Notifications subscription set up successfully');
    
    // Request notification permission if not already granted
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      console.log('Requesting notification permission...');
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
    
    return subscription;
  } catch (error) {
    console.error('Error setting up notifications subscription:', error);
  }
}

// Set up polling for notifications
function setupNotificationsPolling() {
  console.log('Setting up notifications polling...');
  
  // Clear any existing polling
  clearNotificationsPolling();
  
  // Poll every 30 seconds
  notificationsPollingTimer = setInterval(() => {
    console.log('Polling for notifications...');
    loadNotifications();
  }, 30000); // 30 seconds
  
  // Initial load
  loadNotifications();
  
  console.log('Notifications polling set up successfully');
}

// Clear polling for notifications
function clearNotificationsPolling() {
  if (notificationsPollingTimer) {
    console.log('Clearing notifications polling timer');
    clearInterval(notificationsPollingTimer);
    notificationsPollingTimer = null;
  }
}

// Show browser notification
function showBrowserNotification(title, message) {
  console.log('Showing browser notification:', title, message);
  
  // Check if the browser supports notifications
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notifications");
    return;
  }
  
  // Check if permission is already granted
  if (Notification.permission === "granted") {
    try {
      const notification = new Notification(title, { 
        body: message,
        icon: '/favicon.ico',
        requireInteraction: true
      });
      
      notification.onclick = function() {
        window.focus();
        // Navigate to notifications tab
        const notificationsTab = document.querySelector('.tab-button[data-tab="suggestions"]');
        if (notificationsTab) {
          notificationsTab.click();
        }
        this.close();
      };
      
      console.log('Notification created successfully');
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }
  // Otherwise, request permission
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        // Try again after permission is granted
        showBrowserNotification(title, message);
      }
    });
  }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Set up notifications subscription
  setupNotificationsSubscription();
  
  // Set up notifications polling
  setupNotificationsPolling();
  
  // Add event listener for suggestions tab
  const suggestionsTab = document.querySelector('[data-tab="suggestions"]');
  if (suggestionsTab) {
    suggestionsTab.addEventListener('click', () => {
      console.log('Suggestions tab clicked, refreshing notifications...');
      loadNotifications();
    });
  }
  
  // Add a manual refresh button to the notifications section
  const notificationsContainer = document.getElementById('split-suggestions-container');
  if (notificationsContainer) {
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-secondary mb-4';
    refreshButton.innerHTML = 'Refresh Notifications';
    refreshButton.addEventListener('click', () => {
      console.log('Manual refresh requested');
      loadNotifications();
    });
    
    // Insert the button before the container
    notificationsContainer.parentNode.insertBefore(refreshButton, notificationsContainer);
  }
});

// Debug function to check split_suggestions table schema
async function debugSplitSuggestionsSchema() {
  console.log('Debugging split_suggestions table schema...');
  
  try {
    // Check if we can query the table
    const { data, error } = await supabase
      .from('split_suggestions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying split_suggestions table:', error);
      return;
    }
    
    console.log('Split suggestions table exists and can be queried');
    
    // Get the current user
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser || !currentUser.user) {
      console.error('No user logged in');
      return;
    }
    
    const userId = currentUser.user.id;
    
    // Try to create a test suggestion
    const testData = {
      expense_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
      from_user_id: userId,
      to_user_id: userId, // Send to self for testing
      suggested_amount: 10,
      suggested_ratio: 0.5,
      status: 'pending'
    };
    
    console.log('Attempting to create test suggestion:', testData);
    
    const { data: testSuggestion, error: testError } = await supabase
      .from('split_suggestions')
      .insert([testData])
      .select();
    
    if (testError) {
      console.error('Error creating test suggestion:', testError);
      
      // Check if the error is related to foreign key constraints
      if (testError.message.includes('foreign key constraint')) {
        console.log('Error is related to foreign key constraints. This is expected for a dummy expense_id.');
        console.log('The split_suggestions table schema appears to be correct.');
      }
    } else {
      console.log('Test suggestion created successfully:', testSuggestion);
      
      // Clean up the test suggestion
      const { error: deleteError } = await supabase
        .from('split_suggestions')
        .delete()
        .eq('id', testSuggestion[0].id);
      
      if (deleteError) {
        console.error('Error deleting test suggestion:', deleteError);
      } else {
        console.log('Test suggestion deleted successfully');
      }
    }
  } catch (error) {
    console.error('Exception during schema debugging:', error);
  }
}

// Add a debug button to the UI
document.addEventListener('DOMContentLoaded', () => {
  const notificationsHeader = document.querySelector('.card h2');
  if (notificationsHeader && notificationsHeader.textContent.includes('Notifications')) {
    const debugButton = document.createElement('button');
    debugButton.className = 'btn btn-secondary ml-2 text-xs';
    debugButton.textContent = 'Debug';
    debugButton.addEventListener('click', () => {
      debugSplitSuggestionsSchema();
    });
    
    notificationsHeader.appendChild(debugButton);
  }
}); 
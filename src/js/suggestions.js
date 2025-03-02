// Split Suggestions module for Pay Period Allocator

// Store suggestions data
let splitSuggestions = [];

// Load split suggestions
async function loadSplitSuggestions() {
  console.log('Loading split suggestions...');
  
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser || !currentUser.user) {
      console.error('No user logged in');
      return;
    }
    
    const userId = currentUser.user.id;
    
    // Query the split_suggestions table for pending suggestions for this user
    const { data: suggestions, error } = await supabase
      .from('split_suggestions')
      .select(`
        id,
        expense_id,
        from_user_id,
        to_user_id,
        suggested_amount,
        suggested_ratio,
        created_at,
        status,
        expenses (
          name,
          raw_amount,
          raw_frequency,
          category_id
        ),
        profiles:from_user_id (
          name,
          email
        )
      `)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading split suggestions:', error);
      return;
    }
    
    console.log('Split suggestions loaded:', suggestions);
    
    // Update the suggestions count
    updateSuggestionsCount(suggestions.length);
    
    // Render the suggestions
    renderSplitSuggestions(suggestions);
    
  } catch (error) {
    console.error('Error in loadSplitSuggestions:', error);
  }
}

// Update the suggestions count in the UI
function updateSuggestionsCount(count) {
  const countElement = document.getElementById('suggestions-count');
  if (countElement) {
    countElement.textContent = count;
    
    // Show/hide the count based on whether there are suggestions
    if (count > 0) {
      countElement.classList.remove('hidden');
    } else {
      countElement.classList.add('hidden');
    }
  }
}

// Render split suggestions in the UI
function renderSplitSuggestions(suggestions) {
  const container = document.getElementById('split-suggestions-container');
  if (!container) return;
  
  // Clear existing content
  container.innerHTML = '';
  
  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No pending split suggestions found.</p>
      </div>
    `;
    return;
  }
  
  // Create a card for each suggestion
  suggestions.forEach(async suggestion => {
    const expense = suggestion.expenses;
    const suggestedBy = suggestion.profiles;
    
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
    card.className = 'card mb-4';
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="font-semibold">${expense.name}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            ${getFrequencyDisplayName(expense.raw_frequency)} • ${categoryName}
          </p>
          <p class="text-sm mt-1">
            <span class="font-medium">${suggestedBy.name}</span> suggests you pay 
            <span class="font-medium">${formatCurrency(suggestion.suggested_amount)}</span> 
            of the total ${formatCurrency(expense.raw_amount)}
          </p>
        </div>
        <div class="text-right">
          <span class="text-sm text-gray-500 dark:text-gray-400">
            ${formatTimeAgo(suggestion.created_at)}
          </span>
        </div>
      </div>
      <div class="flex space-x-2 mt-3">
        <button class="btn btn-primary btn-sm accept-suggestion" data-id="${suggestion.id}">
          Accept
        </button>
        <button class="btn btn-secondary btn-sm reject-suggestion" data-id="${suggestion.id}">
          Reject
        </button>
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
      .select('suggested_ratio')
      .eq('id', suggestionId)
      .single();
    
    if (suggestionError) {
      console.error('Error getting suggestion:', suggestionError);
      alert('Failed to get the suggestion details. Please try again.');
      return;
    }
    
    // Start a transaction by using multiple operations
    
    // 1. Update the suggestion status to 'accepted'
    const { error: updateError } = await supabase
      .from('split_suggestions')
      .update({ status: 'accepted' })
      .eq('id', suggestionId);
    
    if (updateError) {
      console.error('Error updating suggestion status:', updateError);
      alert('Failed to accept the suggestion. Please try again.');
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
      alert('Failed to create the expense split. Please try again.');
      return;
    }
    
    // Reload suggestions after successful acceptance
    loadSplitSuggestions();
    
    // Show success message
    alert('Split suggestion accepted successfully!');
    
  } catch (error) {
    console.error('Error in acceptSplitSuggestion:', error);
    alert('An error occurred while accepting the suggestion.');
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
      alert('Failed to reject the suggestion. Please try again.');
      return;
    }
    
    // Reload suggestions after successful rejection
    loadSplitSuggestions();
    
    // Show success message
    alert('Split suggestion rejected successfully!');
    
  } catch (error) {
    console.error('Error in rejectSplitSuggestion:', error);
    alert('An error occurred while rejecting the suggestion.');
  }
}

// Format date helper function
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// Format time ago helper function
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 0) {
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  } else if (diffHour > 0) {
    return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  } else if (diffMin > 0) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  } else {
    return 'Just now';
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load suggestions when the suggestions tab is clicked
  const suggestionsTabButton = document.querySelector('.tab-button[data-tab="suggestions"]');
  if (suggestionsTabButton) {
    suggestionsTabButton.addEventListener('click', loadSplitSuggestions);
  }
  
  // Also load suggestions when the page is first loaded if the suggestions tab is active
  if (document.querySelector('[data-tab-content="suggestions"]').classList.contains('active')) {
    loadSplitSuggestions();
  }
}); 
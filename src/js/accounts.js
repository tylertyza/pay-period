// Accounts module for Pay Period Allocator

// Store accounts data
let accounts = [];
// Store shared users for the current account being edited
let sharedUsers = [];

// Load accounts
async function loadAccounts() {
  const { data, error } = await window.supabase
    .from('accounts')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error loading accounts:', error);
    return;
  }
  
  accounts = data || [];
  renderAccounts();
  
  // Update account dropdowns in expense form
  updateAccountDropdown();
}

// Render accounts table
function renderAccounts() {
  const tableBody = document.getElementById('accounts-table-body');
  if (!tableBody) return;
  
  // Clear table
  tableBody.innerHTML = '';
  
  if (accounts.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="4" class="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm italic">
        No accounts found. Add an account to get started.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  // Add accounts to table
  accounts.forEach(account => {
    const ownershipText = getOwnershipText(account.owner_ids);
    
    const row = createTableRow(
      [
        account.name,
        account.type.charAt(0).toUpperCase() + account.type.slice(1),
        ownershipText
      ],
      [
        createEditButton(() => editAccount(account)),
        createDeleteButton(() => confirmDeleteAccount(account))
      ]
    );
    
    tableBody.appendChild(row);
  });
}

// Get ownership text
function getOwnershipText(ownerIds) {
  if (!ownerIds || ownerIds.length === 0) return 'None';
  
  const currentUserId = getCurrentUser()?.id;
  const isOwnedByCurrentUser = ownerIds.includes(currentUserId);
  const isJoint = ownerIds.length > 1;
  
  if (isJoint) return `Joint (${ownerIds.length} users)`;
  if (isOwnedByCurrentUser) return 'Me';
  return 'Shared';
}

// Update account dropdown in expense form
function updateAccountDropdown() {
  const accountDropdown = document.getElementById('expense-account');
  if (!accountDropdown) return;
  
  // Clear dropdown
  accountDropdown.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select an account';
  accountDropdown.appendChild(defaultOption);
  
  // Add accounts to dropdown
  accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = account.name;
    accountDropdown.appendChild(option);
  });
}

// Show account form
function showAccountForm(account = null) {
  const modalTitle = document.getElementById('account-modal-title');
  const accountForm = document.getElementById('account-form');
  const accountId = document.getElementById('account-id');
  const accountName = document.getElementById('account-name');
  const accountType = document.getElementById('account-type');
  const accountOwnerSelf = document.getElementById('account-owner-self');
  
  // Reset form
  accountForm.reset();
  sharedUsers = [];
  
  // Set form values if editing
  if (account) {
    modalTitle.textContent = 'Edit Account';
    accountId.value = account.id;
    accountName.value = account.name;
    accountType.value = account.type;
    
    const currentUserId = getCurrentUser()?.id;
    accountOwnerSelf.checked = account.owner_ids.includes(currentUserId);
    
    // Load shared users
    loadSharedUsers(account.owner_ids);
  } else {
    modalTitle.textContent = 'Add Account';
    accountId.value = '';
    accountOwnerSelf.checked = true;
    
    // Clear shared users
    renderSharedUsers();
  }
  
  // Show modal
  showModal('account-modal');
}

// Load shared users
async function loadSharedUsers(ownerIds) {
  if (!ownerIds || ownerIds.length <= 1) {
    renderSharedUsers();
    return;
  }
  
  const currentUserId = getCurrentUser()?.id;
  const otherUserIds = ownerIds.filter(id => id !== currentUserId);
  
  if (otherUserIds.length === 0) {
    renderSharedUsers();
    return;
  }
  
  // Fetch user details for each ID
  const { data, error } = await window.supabase
    .from('users')
    .select('id, name, email')
    .in('id', otherUserIds);
  
  if (error) {
    console.error('Error loading shared users:', error);
    return;
  }
  
  sharedUsers = data || [];
  renderSharedUsers();
}

// Render shared users
function renderSharedUsers() {
  const container = document.getElementById('shared-users-container');
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  if (sharedUsers.length === 0) {
    container.innerHTML = `
      <div class="text-sm text-gray-500 dark:text-gray-400 italic">
        No shared users. Add users to share this account.
      </div>
    `;
    return;
  }
  
  // Add each shared user
  sharedUsers.forEach(user => {
    const userElement = document.createElement('div');
    userElement.className = 'flex items-center justify-between bg-gray-100 dark:bg-dark-300 p-2 rounded-md mb-2';
    userElement.innerHTML = `
      <div>
        <div class="text-sm font-medium">${user.name}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">${user.email}</div>
      </div>
      <button type="button" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" data-user-id="${user.id}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;
    
    // Add event listener to remove button
    const removeButton = userElement.querySelector('button');
    removeButton.addEventListener('click', () => {
      removeSharedUser(user.id);
    });
    
    container.appendChild(userElement);
  });
}

// Remove shared user
function removeSharedUser(userId) {
  sharedUsers = sharedUsers.filter(user => user.id !== userId);
  renderSharedUsers();
}

// Find user by email
async function findUserByEmail(email) {
  console.log('Searching for user with email:', email);
  
  if (!email || !email.includes('@')) {
    console.error('Invalid email format:', email);
    return null;
  }
  
  try {
    // Try to find the user using a more flexible approach
    // First, try a direct match with exact email
    const { data: exactMatch, error: exactError } = await window.supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email)
      .limit(1);
    
    console.log('Exact match search results:', exactMatch, 'Error:', exactError);
    
    if (exactMatch && exactMatch.length > 0) {
      console.log('User found with exact match:', exactMatch[0]);
      return exactMatch[0];
    }
    
    // If no exact match, try case-insensitive search
    const { data: likeMatch, error: likeError } = await window.supabase
      .from('users')
      .select('id, name, email')
      .ilike('email', email)
      .limit(1);
    
    console.log('Case-insensitive search results:', likeMatch, 'Error:', likeError);
    
    if (likeMatch && likeMatch.length > 0) {
      console.log('User found with case-insensitive match:', likeMatch[0]);
      return likeMatch[0];
    }
    
    // If still no match, try a function call that bypasses RLS
    // Note: This would require a server-side function in a real app
    // For this demo, we'll simulate it with a special endpoint
    
    // Try a different approach - search in auth.users if available
    // This is a workaround and might not work in all environments
    try {
      const { data: authUsers, error: authError } = await window.supabase
        .rpc('find_user_by_email', { email_to_find: email });
      
      console.log('RPC search results:', authUsers, 'Error:', authError);
      
      if (authUsers && authUsers.length > 0) {
        return {
          id: authUsers[0].id,
          name: authUsers[0].name || 'User',
          email: authUsers[0].email
        };
      }
    } catch (rpcError) {
      console.log('RPC method not available:', rpcError);
      // Continue with other methods if RPC fails
    }
    
    console.log('No user found with email:', email);
    return null;
  } catch (e) {
    console.error('Exception during user search:', e);
    return null;
  }
}

// Add user to shared users
async function addUserByEmail(email) {
  console.log('Adding user by email:', email);
  
  // Check if email is valid
  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }
  
  // Normalize email for comparison
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if user already exists in shared users
  const existingUser = sharedUsers.find(user => 
    user.email.toLowerCase() === normalizedEmail
  );
  
  if (existingUser) {
    alert('This user is already shared on this account.');
    return;
  }
  
  // Show loading state
  const addUserButton = document.getElementById('add-user-button');
  const inviteEmailInput = document.getElementById('invite-email');
  
  if (addUserButton) {
    addUserButton.disabled = true;
    addUserButton.textContent = 'Searching...';
  }
  
  try {
    // Find user by email
    const user = await findUserByEmail(normalizedEmail);
    
    // Reset button state
    if (addUserButton) {
      addUserButton.disabled = false;
      addUserButton.textContent = 'Add';
    }
    
    if (!user) {
      // Try one more approach - check if the current user can add this email
      // This is a special case for testing/demo purposes
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.email === normalizedEmail) {
        alert("You can't add yourself as a shared user because you're already the owner.");
        return;
      }
      
      // User not found, offer to send invitation
      if (confirm(`No user found with email ${email}. This user needs to create an account before they can be added. Would you like to send them an invitation?`)) {
        // In a real app, you would send an invitation email here
        alert(`Invitation would be sent to ${email} (not implemented in this demo).`);
      }
      return;
    }
    
    // Add user to shared users
    sharedUsers.push(user);
    renderSharedUsers();
    
    // Clear the input field
    if (inviteEmailInput) {
      inviteEmailInput.value = '';
    }
    
    // Show success message
    alert(`User ${user.name} (${user.email}) has been added to this account.`);
    
  } catch (e) {
    console.error('Error adding user by email:', e);
    alert('An error occurred while adding the user. Please try again.');
    
    // Reset button state
    if (addUserButton) {
      addUserButton.disabled = false;
      addUserButton.textContent = 'Add';
    }
  }
}

// Save account
async function saveAccount(formData) {
  const accountId = formData.get('account-id');
  const name = formData.get('account-name');
  const type = formData.get('account-type');
  
  console.log('Form data:', {
    accountId,
    name,
    type,
    formEntries: Array.from(formData.entries())
  });
  
  if (!name) {
    console.log('Account name is empty or null');
    alert('Please enter an account name.');
    return;
  }
  
  if (!type) {
    alert('Please select an account type.');
    return;
  }
  
  // Get current user ID
  const currentUserId = getCurrentUser()?.id;
  console.log('Current user ID:', currentUserId);
  
  if (!currentUserId) {
    alert('You must be logged in to save an account.');
    return;
  }
  
  // Build owner_ids array
  const ownerIds = [currentUserId];
  sharedUsers.forEach(user => {
    if (!ownerIds.includes(user.id)) {
      ownerIds.push(user.id);
    }
  });
  
  console.log('Owner IDs:', ownerIds);
  
  let result;
  
  // Check if account exists
  if (accountId) {
    // Update existing account
    result = await window.supabase
      .from('accounts')
      .update({
        name,
        type,
        owner_ids: ownerIds
      })
      .eq('id', accountId);
  } else {
    // Create new account
    result = await window.supabase
      .from('accounts')
      .insert({
        name,
        type,
        owner_ids: ownerIds
      });
  }
  
  const { error } = result;
  
  if (error) {
    console.error('Error saving account:', error);
    alert(`Error saving account: ${error.message}`);
    return;
  }
  
  // Reload accounts
  await loadAccounts();
  
  // Hide modal
  hideModal('account-modal');
}

// Edit account
function editAccount(account) {
  showAccountForm(account);
}

// Confirm delete account
function confirmDeleteAccount(account) {
  showConfirmation(
    'Delete Account',
    `Are you sure you want to delete the account "${account.name}"? This will also delete all expenses associated with this account.`,
    () => deleteAccount(account.id)
  );
}

// Delete account
async function deleteAccount(id) {
  const { error } = await window.supabase
    .from('accounts')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting account:', error);
    alert(`Error deleting account: ${error.message}`);
    return;
  }
  
  // Reload accounts
  await loadAccounts();
  
  // Reload expenses (since they may reference this account)
  await loadExpenses();
  
  // Update dashboard
  updateDashboard();
}

// Get account by ID
function getAccountById(accountId) {
  return accounts.find(account => account.id === accountId);
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Add account button
  const addAccountButton = document.getElementById('add-account-button');
  if (addAccountButton) {
    addAccountButton.addEventListener('click', () => {
      showAccountForm();
    });
  }
  
  // Close account modal button
  const closeAccountModalButton = document.getElementById('close-account-modal');
  if (closeAccountModalButton) {
    closeAccountModalButton.addEventListener('click', () => {
      hideModal('account-modal');
    });
  }
  
  // Cancel account button
  const cancelAccountButton = document.getElementById('cancel-account');
  if (cancelAccountButton) {
    cancelAccountButton.addEventListener('click', () => {
      hideModal('account-modal');
    });
  }
  
  // Add user button
  const addUserButton = document.getElementById('add-user-button');
  if (addUserButton) {
    addUserButton.addEventListener('click', () => {
      const email = document.getElementById('invite-email').value;
      addUserByEmail(email);
    });
  }
  
  // Account form submission
  const accountForm = document.getElementById('account-form');
  if (accountForm) {
    accountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(accountForm);
      await saveAccount(formData);
    });
  }
});

// Debug function to help troubleshoot user search issues
async function debugUserSearch(email) {
  console.log('=== DEBUG: User Search ===');
  console.log('Searching for email:', email);
  
  try {
    // Check current user
    const currentUser = getCurrentUser();
    console.log('Current user:', currentUser ? {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.profile?.name
    } : 'Not logged in');
    
    // Try exact match
    console.log('Trying exact match...');
    const { data: exactData, error: exactError } = await window.supabase
      .from('users')
      .select('*')
      .eq('email', email);
    
    console.log('Exact match results:', exactData, 'Error:', exactError);
    
    // Try case-insensitive match
    console.log('Trying case-insensitive match...');
    const { data: likeData, error: likeError } = await window.supabase
      .from('users')
      .select('*')
      .ilike('email', email);
    
    console.log('Case-insensitive results:', likeData, 'Error:', likeError);
    
    // Try RPC function if available
    console.log('Trying RPC function...');
    try {
      const { data: rpcData, error: rpcError } = await window.supabase
        .rpc('find_user_by_email', { email_to_find: email });
      
      console.log('RPC results:', rpcData, 'Error:', rpcError);
    } catch (rpcError) {
      console.log('RPC function not available:', rpcError);
    }
    
    console.log('=== END DEBUG ===');
  } catch (e) {
    console.error('Error in debug function:', e);
  }
}

// Add debug button to the account form
document.addEventListener('DOMContentLoaded', () => {
  const inviteEmailContainer = document.querySelector('#shared-users-container').parentNode;
  
  if (inviteEmailContainer) {
    const debugButton = document.createElement('button');
    debugButton.type = 'button';
    debugButton.className = 'btn btn-secondary mt-2';
    debugButton.textContent = 'Debug Search';
    debugButton.style.fontSize = '0.75rem';
    debugButton.style.padding = '0.25rem 0.5rem';
    
    debugButton.addEventListener('click', () => {
      const email = document.getElementById('invite-email').value;
      if (email) {
        debugUserSearch(email);
      } else {
        alert('Please enter an email to debug');
      }
    });
    
    inviteEmailContainer.appendChild(debugButton);
  }
}); 
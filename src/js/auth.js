// Authentication module for Pay Period Allocator

// Current user
let currentUser = null;

// Session refresh timer
let sessionRefreshTimer = null;

// Initialize auth
async function initAuth() {
  console.log('Initializing auth...');
  
  // Check if Supabase client is available
  if (!window.supabase) {
    console.error('Supabase client is not initialized. Make sure it is loaded before calling initAuth().');
    showAuthForm();
    return;
  }
  
  // Check if user is already logged in
  try {
    console.log('Checking if user is already logged in...');
    
    // Verify that the auth object exists
    if (!window.supabase.auth) {
      throw new Error('Supabase auth object is not available');
    }
    
    // Verify that getSession method exists
    if (typeof window.supabase.auth.getSession !== 'function') {
      throw new Error('getSession method is not available on Supabase auth object');
    }
    
    const { data: { session }, error } = await window.supabase.auth.getSession();
    
    console.log('Current session:', session, 'Error:', error);
    
    if (error) {
      console.error('Error getting session:', error);
      showAuthForm();
      return;
    }
    
    if (session) {
      console.log('User has an active session:', session);
      
      // Check if session is about to expire
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt - now;
      
      console.log('Session expires at:', expiresAt, 'Time until expiry (ms):', timeUntilExpiry);
      
      // If session expires in less than 1 hour, refresh it
      if (timeUntilExpiry < 60 * 60 * 1000) {
        console.log('Session is about to expire, refreshing...');
        const { data: refreshData, error: refreshError } = await window.supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Error refreshing session:', refreshError);
        } else {
          console.log('Session refreshed successfully:', refreshData);
        }
      }
      
      // Set up session refresh timer
      setupSessionRefresh(session);
      
      currentUser = session.user;
      await loadUserProfile();
      showApp();
    } else {
      console.log('No active session, showing auth form');
      showAuthForm();
    }
    
    // Set up auth state change listener
    console.log('Setting up auth state change listener');
    window.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);
      
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in:', session.user);
        currentUser = session.user;
        await loadUserProfile();
        showApp();
        
        // Set up session refresh timer
        setupSessionRefresh(session);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        currentUser = null;
        clearSessionRefresh();
        showAuthForm();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('Session token refreshed:', session);
        currentUser = session.user;
        
        // Don't set up a new refresh timer here to avoid refresh loops
        // The refresh function itself will set up the next timer
      }
    });
  } catch (e) {
    console.error('Exception during auth initialization:', e);
    showAuthForm();
  }
}

// Load user profile
async function loadUserProfile() {
  console.log('loadUserProfile called with currentUser:', currentUser);
  
  if (!currentUser) {
    console.log('No current user, skipping profile load');
    return;
  }
  
  try {
    console.log('Fetching user profile from database...');
    const { data, error } = await window.supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    
    console.log('User profile data:', data, 'Error:', error);
    
    if (error) {
      console.error('Error loading user profile:', error);
      return;
    }
    
    if (data) {
      console.log('Setting user profile data');
      currentUser.profile = data;
      
      // Update user name in the header
      const userNameElement = document.getElementById('current-user-name');
      if (userNameElement && data.name) {
        userNameElement.textContent = data.name;
      }
      
      // Populate settings form if it exists
      populateSettingsForm();
    } else {
      console.log('No profile data found for user');
    }
  } catch (e) {
    console.error('Exception during profile loading:', e);
  }
}

// Populate settings form with user data
function populateSettingsForm() {
  if (!currentUser || !currentUser.profile) return;
  
  const profileNameInput = document.getElementById('profile-name');
  const profileEmailInput = document.getElementById('profile-email');
  
  if (profileNameInput && currentUser.profile.name) {
    profileNameInput.value = currentUser.profile.name;
  }
  
  if (profileEmailInput && currentUser.email) {
    profileEmailInput.value = currentUser.email;
  }
}

// Update user profile
async function updateUserProfile(name) {
  if (!currentUser) return;
  
  try {
    const { data, error } = await window.supabase
      .from('users')
      .update({ name })
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
    
    // Reload user profile
    await loadUserProfile();
    return true;
  } catch (e) {
    console.error('Exception during profile update:', e);
    return false;
  }
}

// Change user password
async function changeUserPassword(currentPassword, newPassword) {
  try {
    // First verify the current password by signing in
    const { error: signInError } = await window.supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword
    });
    
    if (signInError) {
      return { success: false, message: 'Current password is incorrect' };
    }
    
    // Update the password
    const { error } = await window.supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      return { success: false, message: error.message };
    }
    
    return { success: true, message: 'Password updated successfully' };
  } catch (e) {
    console.error('Exception during password change:', e);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

// Show auth form
function showAuthForm() {
  hideElement('app-container');
  showElement('auth-container');
}

// Show app
async function showApp() {
  // Hide auth container
  const authContainer = document.getElementById('auth-container');
  if (authContainer) {
    authContainer.classList.add('hidden');
  }
  
  // Show app container
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.classList.remove('hidden');
  }
  
  // Update user name in header
  const userNameElement = document.getElementById('current-user-name');
  if (userNameElement) {
    userNameElement.textContent = currentUser.profile?.name || currentUser.email || 'User';
  }
  
  // Load initial data
  if (typeof loadAccounts === 'function') {
    await loadAccounts();
  }
  
  if (typeof loadExpenses === 'function') {
    await loadExpenses();
  }
  
  if (typeof loadIncome === 'function') {
    await loadIncome();
  }
  
  if (typeof updateDashboard === 'function') {
    updateDashboard();
  }
  
  // Load notifications immediately
  if (typeof loadNotifications === 'function') {
    await loadNotifications();
  }
  
  // Set up real-time subscriptions
  setupRealtimeSubscriptions();
  
  // Set up notifications polling as a backup
  if (typeof setupNotificationsPolling === 'function') {
    setupNotificationsPolling();
  }
}

// Sign in
async function signIn(email, password) {
  hideError();
  
  console.log('Attempting to sign in with:', email);
  
  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }
  
  try {
    // Get remember me checkbox value
    const rememberMe = document.getElementById('remember-me')?.checked ?? true;
    console.log('Remember me:', rememberMe);
    
    // Set session expiration based on remember me
    const sessionOptions = {
      persistSession: true
    };
    
    // If remember me is checked, use a long expiration (default)
    // If not checked, set a shorter expiration (8 hours)
    if (!rememberMe) {
      sessionOptions.expiresIn = 60 * 60 * 8; // 8 hours in seconds
    }
    
    console.log('Calling supabase.auth.signInWithPassword with options:', sessionOptions);
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email,
      password
    }, sessionOptions);
    
    console.log('Sign in response:', data, error);
    
    if (error) {
      console.error('Error signing in:', error);
      showError(error.message);
      return;
    }
    
    console.log('Sign in successful:', data);
    // The auth state change listener should handle setting the user
    // But let's manually check if it's working
    if (data && data.user) {
      console.log('Manually setting currentUser and showing app');
      currentUser = data.user;
      await loadUserProfile();
      showApp();
    }
  } catch (e) {
    console.error('Exception during sign in:', e);
    showError('An unexpected error occurred. Please try again.');
  }
}

// Sign up
async function signUp(email, password, name) {
  hideError();
  
  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }
  
  if (!name) {
    showError('Please enter your name.');
    return;
  }
  
  const { data, error } = await window.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name
      }
    }
  });
  
  if (error) {
    console.error('Error signing up:', error);
    showError(error.message);
    return;
  }
  
  showSuccess('Please check your email to confirm your account. You will be able to log in after confirming your email.', 'auth-message');
}

// Sign out
async function signOut() {
  clearSessionRefresh();
  const { error } = await window.supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    return;
  }
  
  // User will be unset by the auth state change listener
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Get partner user (for expense splits)
async function getPartnerUser() {
  if (!currentUser) return null;
  
  const { data, error } = await window.supabase
    .from('users')
    .select('*')
    .neq('id', currentUser.id)
    .limit(1)
    .single();
  
  if (error) {
    console.error('Error getting partner user:', error);
    return null;
  }
  
  return data;
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginButton = document.getElementById('login-button');
  if (loginButton) {
    loginButton.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      await signIn(email, password);
    });
  }
  
  // Signup button
  const signupButton = document.getElementById('signup-button');
  if (signupButton) {
    signupButton.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Toggle to signup mode
      const authForm = document.getElementById('auth-form');
      
      if (!document.getElementById('name')) {
        // Add name field
        const emailField = document.getElementById('email').parentNode;
        
        const nameField = document.createElement('div');
        nameField.className = 'mb-4';
        nameField.innerHTML = `
          <label for="name" class="label">Name</label>
          <input type="text" id="name" class="input" placeholder="Your name">
        `;
        
        authForm.insertBefore(nameField, emailField);
        
        // Change button text
        signupButton.textContent = 'Create Account';
        loginButton.textContent = 'Back to Sign In';
      } else {
        // Process signup
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;
        
        await signUp(email, password, name);
      }
    });
  }
  
  // Logout button
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
    });
  }
  
  // Settings tab event listeners
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-name').value;
      
      if (!name) {
        showError('Please enter your name.', 'profile-error');
        return;
      }
      
      const success = await updateUserProfile(name);
      if (success) {
        showSuccess('Profile updated successfully.', 'profile-success');
      } else {
        showError('Failed to update profile.', 'profile-error');
      }
    });
  }
  
  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      
      // Clear previous messages
      hideError('password-error');
      hideError('password-success');
      
      if (!currentPassword || !newPassword || !confirmPassword) {
        showError('Please fill in all password fields.', 'password-error');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        showError('New passwords do not match.', 'password-error');
        return;
      }
      
      if (newPassword.length < 6) {
        showError('New password must be at least 6 characters.', 'password-error');
        return;
      }
      
      const result = await changeUserPassword(currentPassword, newPassword);
      if (result.success) {
        showSuccess(result.message, 'password-success');
        passwordForm.reset();
      } else {
        showError(result.message, 'password-error');
      }
    });
  }
  
  const toggleDarkModeButton = document.getElementById('toggle-dark-mode');
  if (toggleDarkModeButton) {
    toggleDarkModeButton.addEventListener('click', () => {
      toggleDarkMode();
    });
  }
  
  const defaultFrequencySelect = document.getElementById('default-frequency');
  if (defaultFrequencySelect) {
    // Set initial value from localStorage or default
    const savedFrequency = localStorage.getItem('defaultFrequency') || 'biweekly';
    defaultFrequencySelect.value = savedFrequency;
    
    defaultFrequencySelect.addEventListener('change', () => {
      const frequency = defaultFrequencySelect.value;
      localStorage.setItem('defaultFrequency', frequency);
      
      // Update the main frequency selector if it exists
      const frequencySelector = document.getElementById('frequency-selector');
      if (frequencySelector) {
        frequencySelector.value = frequency;
        // Trigger change event to update the UI
        frequencySelector.dispatchEvent(new Event('change'));
      }
    });
  }
});

// Set up session refresh timer
function setupSessionRefresh(session) {
  // Clear any existing timer
  clearSessionRefresh();
  
  // Check if session is valid
  if (!session || !session.expires_at) {
    console.log('Invalid session or missing expiration time, not setting up refresh timer');
    return;
  }
  
  // Calculate when to refresh (5 minutes before expiry)
  const expiresAt = new Date(session.expires_at * 1000); // Convert to milliseconds if needed
  const refreshTime = expiresAt.getTime() - (5 * 60 * 1000); // 5 minutes before expiry
  const now = new Date().getTime();
  
  // Set up timer with a minimum delay of 1 minute to prevent refresh loops
  const timeUntilRefresh = Math.max(refreshTime - now, 60000); // At least 1 minute
  
  // Don't set up refresh if the session is already expired or about to expire
  if (expiresAt <= now) {
    console.log('Session already expired, not setting up refresh timer');
    return;
  }
  
  console.log(`Setting up session refresh timer for ${timeUntilRefresh}ms from now (expires at ${expiresAt.toISOString()})`);
  
  sessionRefreshTimer = setTimeout(async () => {
    console.log('Refreshing session...');
    try {
      const { data, error } = await window.supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        showAuthForm();
      } else if (data && data.session) {
        console.log('Session refreshed successfully:', data);
        setupSessionRefresh(data.session);
      } else {
        console.error('No session data returned from refresh');
        showAuthForm();
      }
    } catch (e) {
      console.error('Exception during session refresh:', e);
      showAuthForm();
    }
  }, timeUntilRefresh);
}

// Clear session refresh timer
function clearSessionRefresh() {
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
    sessionRefreshTimer = null;
  }
}

// Set up real-time subscriptions
function setupRealtimeSubscriptions() {
  if (!window.supabase) {
    console.error('Supabase client not available for real-time subscriptions');
    return;
  }
  
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) {
    console.error('No current user ID for real-time subscriptions');
    return;
  }
  
  console.log('Setting up real-time subscriptions for user:', currentUserId);
  
  // Set up notifications subscription
  if (typeof setupNotificationsSubscription === 'function') {
    setupNotificationsSubscription();
  }
  
  console.log('Real-time subscriptions set up successfully');
}

// Show a notification
function showNotification(title, message) {
  // Check if the browser supports notifications
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notifications");
    return;
  }
  
  // Check if permission is already granted
  if (Notification.permission === "granted") {
    new Notification(title, { body: message });
  }
  // Otherwise, request permission
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body: message });
      }
    });
  }
} 
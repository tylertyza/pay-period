// Authentication module for Pay Period Allocator

// Current user
let currentUser = null;

// Session refresh timer
let sessionRefreshTimer = null;

// Initialize auth
async function initAuth() {
  console.log('Initializing auth...');
  
  // Check if user is already logged in
  try {
    console.log('Checking if user is already logged in...');
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
        
        // Update session refresh timer
        setupSessionRefresh(session);
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
    } else {
      console.log('No profile data found for user');
    }
  } catch (e) {
    console.error('Exception during profile loading:', e);
  }
}

// Show auth form
function showAuthForm() {
  hideElement('app-container');
  showElement('auth-container');
}

// Show app
function showApp() {
  console.log('showApp called');
  console.log('auth-container element:', document.getElementById('auth-container'));
  console.log('app-container element:', document.getElementById('app-container'));
  
  hideElement('auth-container');
  showElement('app-container');
  
  console.log('After hiding/showing - auth-container hidden:', document.getElementById('auth-container').classList.contains('hidden'));
  console.log('After hiding/showing - app-container hidden:', document.getElementById('app-container').classList.contains('hidden'));
  
  // Load initial data
  loadAccounts();
  loadExpenses();
  loadIncome();
  updateDashboard();
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
  
  showError('Please check your email to confirm your account.', 'auth-message');
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
});

// Set up session refresh timer
function setupSessionRefresh(session) {
  // Clear any existing timer
  clearSessionRefresh();
  
  if (!session || !session.expires_at) return;
  
  const expiresAt = new Date(session.expires_at * 1000);
  const now = new Date();
  let timeUntilExpiry = expiresAt - now;
  
  // If already expired, don't set up a refresh
  if (timeUntilExpiry <= 0) return;
  
  // Refresh 5 minutes before expiry or halfway to expiry if less than 10 minutes
  const refreshTime = Math.min(timeUntilExpiry - (5 * 60 * 1000), timeUntilExpiry / 2);
  
  // Don't set a timer if refresh time is negative
  if (refreshTime <= 0) return;
  
  console.log(`Setting up session refresh in ${refreshTime / 1000 / 60} minutes`);
  
  sessionRefreshTimer = setTimeout(async () => {
    console.log('Refreshing session automatically...');
    try {
      const { data, error } = await window.supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
      } else {
        console.log('Session refreshed successfully:', data);
      }
    } catch (e) {
      console.error('Exception during session refresh:', e);
    }
  }, refreshTime);
}

// Clear session refresh timer
function clearSessionRefresh() {
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
    sessionRefreshTimer = null;
  }
} 
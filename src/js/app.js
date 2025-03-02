// Main application file for Pay Period Allocator

// Initialize the application
async function initApp() {
  console.log('Initializing app...');
  try {
    // Initialize authentication
    await initAuth();
    
    // Set up tab navigation
    setupTabs();
    
    // Set up dark mode toggle
    setupDarkMode();
    
    // Initialize notifications if the user is logged in
    const currentUser = getCurrentUser();
    if (currentUser && typeof loadNotifications === 'function') {
      console.log('Initializing notifications for logged in user');
      loadNotifications();
    }
    
    console.log('App initialization complete');
  } catch (error) {
    console.error('Error initializing app:', error);
  }
}

// Set up tab navigation
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      showTab(tabName);
      
      // Load data based on the tab
      if (tabName === 'suggestions') {
        // Load notifications when the suggestions tab is clicked
        if (typeof loadNotifications === 'function') {
          loadNotifications();
        }
      }
    });
  });
}

// Set up dark mode toggle
function setupDarkMode() {
  // Check if dark mode is already enabled
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // Add dark mode toggle button to header
  const header = document.querySelector('header .flex.items-center');
  
  if (header) {
    const darkModeButton = document.createElement('button');
    darkModeButton.className = 'p-1 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300';
    darkModeButton.innerHTML = isDarkMode 
      ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>';
    
    darkModeButton.addEventListener('click', toggleDarkMode);
    
    // Insert before the frequency selector
    header.insertBefore(darkModeButton, header.firstChild);
  }
}

// Toggle dark mode
function toggleDarkMode() {
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  if (isDarkMode) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', 'light');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkMode', 'dark');
  }
  
  // Update the button icon
  const darkModeButton = document.querySelector('header button');
  if (darkModeButton) {
    darkModeButton.innerHTML = !isDarkMode 
      ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>';
  }
}

// This is now handled in index.html after Supabase initialization
// document.addEventListener('DOMContentLoaded', initApp); 
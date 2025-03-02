// Utility functions for the Pay Period Allocator app

// Show an element
function showElement(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.remove('hidden');
  }
}

// Hide an element
function hideElement(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.add('hidden');
  }
}

// Show a tab
function showTab(tabName) {
  // Hide all tab content
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
    tab.classList.remove('active');
  });
  
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
    button.classList.remove('border-primary-500');
    button.classList.remove('text-primary-600');
    button.classList.remove('dark:text-primary-400');
    button.classList.add('border-transparent');
    button.classList.add('text-gray-500');
    button.classList.add('dark:text-gray-400');
  });
  
  // Show the selected tab content
  const tabContent = document.querySelector(`[data-tab-content="${tabName}"]`);
  if (tabContent) {
    tabContent.classList.remove('hidden');
    tabContent.classList.add('active');
  }
  
  // Activate the selected tab button
  const tabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
  if (tabButton) {
    tabButton.classList.add('active');
    tabButton.classList.add('border-primary-500');
    tabButton.classList.add('text-primary-600');
    tabButton.classList.add('dark:text-primary-400');
    tabButton.classList.remove('border-transparent');
    tabButton.classList.remove('text-gray-500');
    tabButton.classList.remove('dark:text-gray-400');
  }
}

// Show a modal
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    // Add event listener to close when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideModal(modalId);
      }
    });
  }
}

// Hide a modal
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Show a confirmation dialog
function showConfirmation(title, message, onConfirm, confirmButtonText = 'Confirm') {
  const titleElement = document.getElementById('confirmation-title');
  const messageElement = document.getElementById('confirmation-message');
  const confirmButton = document.getElementById('confirm-action');
  const cancelButton = document.getElementById('cancel-confirmation');
  
  if (titleElement) titleElement.textContent = title;
  if (messageElement) messageElement.textContent = message;
  
  // Remove previous event listeners
  const newConfirmButton = confirmButton.cloneNode(true);
  confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
  
  // Set the button text
  newConfirmButton.textContent = confirmButtonText;
  
  // Clone and replace cancel button to remove any previous event listeners
  const newCancelButton = cancelButton.cloneNode(true);
  cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
  
  // Add new event listener for confirm button
  newConfirmButton.addEventListener('click', () => {
    hideModal('confirmation-modal');
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  });
  
  // Add event listener for cancel button
  newCancelButton.addEventListener('click', () => {
    hideModal('confirmation-modal');
  });
  
  // Show the modal
  showModal('confirmation-modal');
}

// Show an error message
function showError(message, elementId = 'auth-error') {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    errorElement.classList.add('text-red-500');
    errorElement.classList.remove('text-green-500');
  }
}

// Show a success message
function showSuccess(message, elementId = 'auth-error') {
  const messageElement = document.getElementById(elementId);
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.classList.remove('hidden');
    messageElement.classList.add('text-green-500');
    messageElement.classList.remove('text-red-500');
  }
}

// Hide an error message
function hideError(elementId = 'auth-error') {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.classList.add('hidden');
  }
}

// Create a table row element
function createTableRow(cells, actions = null) {
  const tr = document.createElement('tr');
  tr.className = 'hover:bg-gray-50 dark:hover:bg-dark-300';
  
  // Add cells
  cells.forEach(cell => {
    const td = document.createElement('td');
    td.className = 'px-4 py-4 whitespace-nowrap';
    
    if (typeof cell === 'string' || typeof cell === 'number') {
      td.textContent = cell;
    } else {
      td.appendChild(cell);
    }
    
    tr.appendChild(td);
  });
  
  // Add actions if provided
  if (actions) {
    const td = document.createElement('td');
    td.className = 'px-4 py-4 whitespace-nowrap text-right';
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex justify-end space-x-2';
    
    actions.forEach(action => {
      actionsDiv.appendChild(action);
    });
    
    td.appendChild(actionsDiv);
    tr.appendChild(td);
  }
  
  return tr;
}

// Create an action button
function createActionButton(icon, label, onClick, isPrimary = false) {
  const button = document.createElement('button');
  button.className = `p-1 rounded-md ${isPrimary ? 'text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`;
  button.setAttribute('title', label);
  button.innerHTML = icon;
  
  if (typeof onClick === 'function') {
    button.addEventListener('click', onClick);
  }
  
  return button;
}

// Create an edit button
function createEditButton(onClick) {
  return createActionButton(
    '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>',
    'Edit',
    onClick,
    true
  );
}

// Create a delete button
function createDeleteButton(onClick) {
  return createActionButton(
    '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>',
    'Delete',
    onClick
  );
}

// Parse CSV data
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const result = [];
  const headers = lines[0].split(',').map(header => header.trim());
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const obj = {};
    const currentLine = lines[i].split(',');
    
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentLine[j].trim();
    }
    
    result.push(obj);
  }
  
  return result;
}

// Export data to CSV
function exportToCSV(data, filename) {
  if (!data || !data.length) {
    console.error('No data to export');
    return;
  }
  
  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  let csvContent = headers.join(',') + '\n';
  
  data.forEach(item => {
    const row = headers.map(header => {
      // Handle values that might contain commas
      const value = item[header] !== undefined ? item[header] : '';
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    });
    
    csvContent += row.join(',') + '\n';
  });
  
  // Create a download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 
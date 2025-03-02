// Income module for Pay Period Allocator

// Store income data
let incomes = [];

// Load income
async function loadIncome() {
  const { data, error } = await window.supabase
    .from('income')
    .select('*')
    .order('source');
  
  if (error) {
    console.error('Error loading income:', error);
    return;
  }
  
  incomes = data || [];
  renderIncome();
  
  // Update dashboard
  updateDashboard();
}

// Render income table
function renderIncome() {
  const tableBody = document.getElementById('income-table-body');
  if (!tableBody) return;
  
  // Clear table
  tableBody.innerHTML = '';
  
  if (incomes.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="4" class="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm italic">
        No income found. Add income to get started.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  // Get current display frequency
  const displayFrequency = getCurrentFrequency();
  
  // Add income to table
  incomes.forEach(income => {
    // Convert amount to display frequency
    const displayAmount = convertAmount(
      income.raw_amount,
      income.raw_frequency,
      displayFrequency
    );
    
    const row = createTableRow(
      [
        income.source,
        formatCurrency(displayAmount),
        getFrequencyDisplayName(displayFrequency)
      ],
      [
        createEditButton(() => editIncome(income)),
        createDeleteButton(() => confirmDeleteIncome(income))
      ]
    );
    
    tableBody.appendChild(row);
  });
}

// Show income form
function showIncomeForm(income = null) {
  const modalTitle = document.getElementById('income-modal-title');
  const incomeForm = document.getElementById('income-form');
  const incomeId = document.getElementById('income-id');
  const incomeSource = document.getElementById('income-source');
  const incomeAmount = document.getElementById('income-amount');
  const incomeFrequency = document.getElementById('income-frequency');
  
  // Reset form
  incomeForm.reset();
  
  // Set form values if editing
  if (income) {
    modalTitle.textContent = 'Edit Income';
    incomeId.value = income.id;
    incomeSource.value = income.source;
    incomeAmount.value = income.raw_amount;
    incomeFrequency.value = income.raw_frequency;
  } else {
    modalTitle.textContent = 'Add Income';
    incomeId.value = '';
  }
  
  // Show modal
  showModal('income-modal');
}

// Save income
async function saveIncome(formData) {
  const incomeId = formData.get('income-id');
  const source = formData.get('income-source');
  const rawAmount = parseFloat(formData.get('income-amount'));
  const rawFrequency = formData.get('income-frequency');
  
  if (!source) {
    console.error('Please enter an income source.');
    return;
  }
  
  if (isNaN(rawAmount) || rawAmount <= 0) {
    console.error('Please enter a valid amount.');
    return;
  }
  
  if (!rawFrequency) {
    console.error('Please enter a frequency.');
    return;
  }
  
  // Calculate normalised amount (monthly)
  const parsedFrequency = parseFrequency(rawFrequency);
  const normalisedAmount = convertAmount(rawAmount, parsedFrequency, 'monthly');
  
  // Get current user ID
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) {
    console.error('You must be logged in to save income.');
    return;
  }
  
  // Create or update income
  let result;
  
  if (incomeId) {
    // Update existing income
    result = await window.supabase
      .from('income')
      .update({
        source,
        raw_amount: rawAmount,
        raw_frequency: rawFrequency,
        normalised_amount: normalisedAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', incomeId);
  } else {
    // Create new income
    result = await window.supabase
      .from('income')
      .insert({
        user_id: currentUserId,
        source,
        raw_amount: rawAmount,
        raw_frequency: rawFrequency,
        normalised_amount: normalisedAmount
      });
  }
  
  const { error } = result;
  
  if (error) {
    console.error('Error saving income:', error);
    return;
  }
  
  // Reload income
  await loadIncome();
  
  // Hide modal
  hideModal('income-modal');
}

// Edit income
function editIncome(income) {
  showIncomeForm(income);
}

// Confirm delete income
function confirmDeleteIncome(income) {
  showConfirmation(
    'Delete Income',
    `Are you sure you want to delete the income source "${income.source}"?`,
    () => deleteIncome(income.id)
  );
}

// Delete income
async function deleteIncome(incomeId) {
  const { error } = await window.supabase
    .from('income')
    .delete()
    .eq('id', incomeId);
  
  if (error) {
    console.error('Error deleting income:', error);
    return;
  }
  
  // Reload income
  await loadIncome();
}

// Get total income amount
function getTotalIncomeAmount(frequency = 'monthly') {
  return incomes.reduce((total, income) => {
    const amount = convertAmount(income.raw_amount, income.raw_frequency, frequency);
    return total + amount;
  }, 0);
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Add income button
  const addIncomeButton = document.getElementById('add-income-button');
  if (addIncomeButton) {
    addIncomeButton.addEventListener('click', () => {
      showIncomeForm();
    });
  }
  
  // Close income modal button
  const closeIncomeModalButton = document.getElementById('close-income-modal');
  if (closeIncomeModalButton) {
    closeIncomeModalButton.addEventListener('click', () => {
      hideModal('income-modal');
    });
  }
  
  // Cancel income button
  const cancelIncomeButton = document.getElementById('cancel-income');
  if (cancelIncomeButton) {
    cancelIncomeButton.addEventListener('click', () => {
      hideModal('income-modal');
    });
  }
  
  // Income form submission
  const incomeForm = document.getElementById('income-form');
  if (incomeForm) {
    incomeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(incomeForm);
      await saveIncome(formData);
    });
  }
}); 
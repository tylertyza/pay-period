// Import module for Pay Period Allocator

// Import data from CSV/Excel
async function importData(file) {
  if (!file) {
    alert('Please select a file to import.');
    return;
  }
  
  // Check file extension
  const fileExtension = file.name.split('.').pop().toLowerCase();
  if (fileExtension !== 'csv' && fileExtension !== 'xlsx' && fileExtension !== 'xls') {
    alert('Please select a CSV or Excel file.');
    return;
  }
  
  // Read file
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      let data;
      
      if (fileExtension === 'csv') {
        // Parse CSV
        data = parseCSV(e.target.result);
      } else {
        // For Excel files, we would need a library like SheetJS
        alert('Excel import is not supported in this version. Please export to CSV first.');
        return;
      }
      
      if (!data || data.length === 0) {
        alert('No data found in the file.');
        return;
      }
      
      // Validate data structure
      const requiredColumns = ['Name', 'Amount', 'Frequency'];
      const missingColumns = requiredColumns.filter(col => !Object.keys(data[0]).includes(col));
      
      if (missingColumns.length > 0) {
        alert(`Missing required columns: ${missingColumns.join(', ')}`);
        return;
      }
      
      // Import expenses
      await importExpenses(data);
      
    } catch (error) {
      console.error('Error importing data:', error);
      alert(`Error importing data: ${error.message}`);
    }
  };
  
  reader.onerror = () => {
    alert('Error reading file.');
  };
  
  if (fileExtension === 'csv') {
    reader.readAsText(file);
  } else {
    reader.readAsBinaryString(file);
  }
}

// Import expenses from parsed data
async function importExpenses(data) {
  // Get current user ID
  const currentUserId = getCurrentUser()?.id;
  if (!currentUserId) {
    alert('You must be logged in to import expenses.');
    return;
  }
  
  // Show confirmation
  const confirmImport = confirm(`Ready to import ${data.length} expenses. Continue?`);
  if (!confirmImport) return;
  
  // Track import progress
  let imported = 0;
  let errors = 0;
  
  // Process each expense
  for (const item of data) {
    try {
      // Extract data
      const name = item.Name;
      const rawAmount = parseFloat(item.Amount);
      const rawFrequency = item.Frequency;
      
      // Validate data
      if (!name || isNaN(rawAmount) || rawAmount <= 0 || !rawFrequency) {
        console.error('Invalid expense data:', item);
        errors++;
        continue;
      }
      
      // Calculate normalised amount (monthly)
      const parsedFrequency = parseFrequency(rawFrequency);
      const normalisedAmount = convertAmount(rawAmount, parsedFrequency, 'monthly');
      
      // Find account and category if provided
      let accountId = null;
      let categoryId = null;
      
      if (item.Account) {
        const account = accounts.find(a => a.name.toLowerCase() === item.Account.toLowerCase());
        if (account) {
          accountId = account.id;
        }
      }
      
      if (item.Category) {
        const category = categories.find(c => c.name.toLowerCase() === item.Category.toLowerCase());
        if (category) {
          categoryId = category.id;
        }
      }
      
      // Create expense
      const { data: expenseData, error: expenseError } = await window.supabase
        .from('expenses')
        .insert({
          name,
          raw_amount: rawAmount,
          raw_frequency: rawFrequency,
          normalised_amount: normalisedAmount,
          account_id: accountId,
          category_id: categoryId,
          notes: item.Notes || null,
          due_date: item.DueDate || null,
          auto_pay: item.AutoPay || false
        });
      
      if (expenseError) {
        console.error('Error creating expense:', expenseError);
        errors++;
        continue;
      }
      
      // Get the expense ID
      const expenseId = expenseData[0]?.id;
      if (!expenseId) {
        console.error('No expense ID returned');
        errors++;
        continue;
      }
      
      // Create expense split (default to 50/50)
      const splitRatio = item.Split ? parseFloat(item.Split) / 100 : 0.5;
      
      await saveExpenseSplit(expenseId, splitRatio);
      
      imported++;
    } catch (error) {
      console.error('Error processing expense:', error, item);
      errors++;
    }
  }
  
  // Show results
  alert(`Import complete: ${imported} expenses imported, ${errors} errors.`);
  
  // Reload expenses
  await loadExpenses();
}

// Export expenses to CSV
function exportExpenses() {
  if (!expenses || expenses.length === 0) {
    alert('No expenses to export.');
    return;
  }
  
  // Prepare data for export
  const exportData = expenses.map(expense => {
    const account = getAccountById(expense.account_id);
    const category = getCategoryById(expense.category_id);
    const splitRatio = getSplitRatio(expense);
    
    return {
      Name: expense.name,
      Amount: expense.raw_amount,
      Frequency: expense.raw_frequency,
      Account: account ? account.name : '',
      Category: category ? category.name : '',
      Split: Math.round(splitRatio * 100)
    };
  });
  
  // Export to CSV
  exportToCSV(exportData, 'expenses.csv');
}

// Export income to CSV
function exportIncome() {
  if (!incomes || incomes.length === 0) {
    alert('No income to export.');
    return;
  }
  
  // Prepare data for export
  const exportData = incomes.map(income => {
    return {
      Source: income.source,
      Amount: income.raw_amount,
      Frequency: income.raw_frequency
    };
  });
  
  // Export to CSV
  exportToCSV(exportData, 'income.csv');
}

// Export all data to CSV
function exportAllData() {
  // Export expenses
  exportExpenses();
  
  // Export income
  exportIncome();
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Import button
  const importButton = document.getElementById('import-button');
  const importFile = document.getElementById('import-file');
  
  if (importButton && importFile) {
    importButton.addEventListener('click', () => {
      if (importFile.files.length > 0) {
        importData(importFile.files[0]);
      } else {
        alert('Please select a file to import.');
      }
    });
  }
  
  // Export expenses button
  const exportExpensesButton = document.getElementById('export-expenses-button');
  if (exportExpensesButton) {
    exportExpensesButton.addEventListener('click', exportExpenses);
  }
  
  // Export income button
  const exportIncomeButton = document.getElementById('export-income-button');
  if (exportIncomeButton) {
    exportIncomeButton.addEventListener('click', exportIncome);
  }
  
  // Export all button
  const exportAllButton = document.getElementById('export-all-button');
  if (exportAllButton) {
    exportAllButton.addEventListener('click', exportAllData);
  }
}); 
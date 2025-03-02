// Supabase configuration
// These values are now set in index.html
// const SUPABASE_URL = window.SUPABASE_URL || 'your-supabase-url';
// const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

// Use the globally initialized Supabase client
// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Default frequency for display
const DEFAULT_FREQUENCY = 'biweekly';

// Frequency conversion factors (to monthly)
const FREQUENCY_FACTORS = {
  daily: 30.4375, // Average days in a month
  weekly: 4.34524, // Average weeks in a month
  biweekly: 2.17262, // Average bi-weeks in a month
  monthly: 1,
  quarterly: 1/3,
  yearly: 1/12,
  // Custom frequencies will be calculated dynamically
};

// Parse custom frequency strings
function parseFrequency(frequencyStr) {
  frequencyStr = frequencyStr.toLowerCase().trim();
  
  // Check for standard frequencies
  if (frequencyStr === 'daily') return { type: 'daily', factor: FREQUENCY_FACTORS.daily };
  if (frequencyStr === 'weekly') return { type: 'weekly', factor: FREQUENCY_FACTORS.weekly };
  if (frequencyStr === 'bi-weekly' || frequencyStr === 'biweekly' || frequencyStr === 'fortnightly') 
    return { type: 'biweekly', factor: FREQUENCY_FACTORS.biweekly };
  if (frequencyStr === 'monthly') return { type: 'monthly', factor: FREQUENCY_FACTORS.monthly };
  if (frequencyStr === 'quarterly') return { type: 'quarterly', factor: FREQUENCY_FACTORS.quarterly };
  if (frequencyStr === 'yearly' || frequencyStr === 'annually') 
    return { type: 'yearly', factor: FREQUENCY_FACTORS.yearly };
  
  // Parse custom frequencies like "every 2 weeks" or "every 20 days"
  const everyMatch = frequencyStr.match(/every\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/i);
  if (everyMatch) {
    const value = parseInt(everyMatch[1]);
    const unit = everyMatch[2].toLowerCase();
    
    if (unit === 'day' || unit === 'days') {
      return { 
        type: 'custom', 
        value, 
        unit: 'days',
        factor: FREQUENCY_FACTORS.daily / value 
      };
    }
    
    if (unit === 'week' || unit === 'weeks') {
      return { 
        type: 'custom', 
        value, 
        unit: 'weeks',
        factor: FREQUENCY_FACTORS.weekly / value 
      };
    }
    
    if (unit === 'month' || unit === 'months') {
      return { 
        type: 'custom', 
        value, 
        unit: 'months',
        factor: FREQUENCY_FACTORS.monthly / value 
      };
    }
    
    if (unit === 'year' || unit === 'years') {
      return { 
        type: 'custom', 
        value, 
        unit: 'years',
        factor: FREQUENCY_FACTORS.yearly / value 
      };
    }
  }
  
  // Default to monthly if we can't parse
  console.warn(`Could not parse frequency: ${frequencyStr}. Defaulting to monthly.`);
  return { type: 'monthly', factor: FREQUENCY_FACTORS.monthly };
}

// Convert amount from one frequency to another
function convertAmount(amount, fromFrequency, toFrequency) {
  const fromFactor = typeof fromFrequency === 'string' 
    ? parseFrequency(fromFrequency).factor 
    : fromFrequency.factor;
  
  const toFactor = typeof toFrequency === 'string' 
    ? parseFrequency(toFrequency).factor 
    : toFrequency.factor;
  
  // Convert to monthly first, then to target frequency
  const monthlyAmount = amount * fromFactor;
  return monthlyAmount / toFactor;
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2
  }).format(amount);
}

// Format percentage
function formatPercentage(value) {
  return new Intl.NumberFormat('en-AU', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

// Get current display frequency
function getCurrentFrequency() {
  const frequencySelector = document.getElementById('frequency-selector');
  return frequencySelector ? frequencySelector.value : DEFAULT_FREQUENCY;
}

// Get frequency display name
function getFrequencyDisplayName(frequency) {
  if (typeof frequency === 'string') {
    frequency = parseFrequency(frequency);
  }
  
  switch (frequency.type) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Bi-Weekly';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Yearly';
    case 'custom':
      return `Every ${frequency.value} ${frequency.unit}`;
    default:
      return 'Custom';
  }
} 
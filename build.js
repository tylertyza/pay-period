const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure the public/css directory exists
const cssDir = path.join(__dirname, 'public', 'css');
if (!fs.existsSync(cssDir)) {
  fs.mkdirSync(cssDir, { recursive: true });
}

console.log('Building TailwindCSS styles...');

try {
  // Run the npm script to build CSS
  execSync('npm run build:css', { 
    stdio: 'inherit' 
  });
  console.log('TailwindCSS styles built successfully!');
} catch (error) {
  console.error('Error building TailwindCSS styles:', error.message);
  process.exit(1);
} 
const { execSync } = require('child_process');
const { spawn } = require('child_process');

console.log('Building TailwindCSS styles...');

try {
  // Build the TailwindCSS styles
  execSync('node build.js', { stdio: 'inherit' });
  
  console.log('Starting server...');
  
  // Start the server
  const server = spawn('node', ['server.js'], { stdio: 'inherit' });
  
  // Handle server exit
  server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Stopping server...');
    server.kill('SIGINT');
    process.exit(0);
  });
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} 
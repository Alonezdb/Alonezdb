const { execSync } = require('child_process');
const path = require('path');

function runScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`Running: node ${scriptPath}`);
  try {
    const output = execSync(`node "${scriptPath}"`, { encoding: 'utf-8' });
    console.log(output);
  } catch (error) {
    console.error(`Error running ${scriptName}:`, error.stderr || error.message);
  }
}

function main() {
  console.log("=== STARTING SVG GENERATION BUILD ===");
  runScript('spotify.js');
  runScript('metrics.js');
  console.log("=== BUILD COMPLETE ===");
}

main();

// This script clones the Headlamp repository, checks out the 'backstage' branch,
// runs 'make backend-embed' to build the binaries, and copies the resulting binaries
// into the appropriate bin/ folders within the project.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoUrl = 'https://github.com/headlamp-k8s/headlamp';
const branch = 'backstage';
const cloneDir = 'headlamp-repo';
const binaries = [
  { src: 'backend/headlamp-server-darwin-arm64', dest: '../packages/backstage-plugin-headlamp-app-darwin-arm64/bin/headlamp-server' },
  { src: 'backend/headlamp-server-linux-x64', dest: '../packages/backstage-plugin-headlamp-app-linux-x64-gnu/bin/headlamp-server' },
  { src: 'backend/headlamp-server-win32-x64.exe', dest: '../packages/backstage-plugin-headlamp-app-win32-x64-msvc/bin/headlamp-server.exe' }
];

function runCommand(command, errorMessage) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`${errorMessage}:`, error.message);
    process.exit(1);
  }
}

try {
  if (!fs.existsSync(cloneDir)) {
    console.log('Cloning the repository...');
    runCommand(`git clone ${repoUrl} ${cloneDir}`, 'Failed to clone the repository');
  } else {
    console.log('Repository already exists. Skipping clone.');
  }
  
  console.log('Checking out the branch...');
  runCommand(`cd ${cloneDir} && git checkout ${branch}`, 'Failed to checkout the branch');
  
  console.log('Running make backend-embed...');
  runCommand(`cd ${cloneDir} && make backend-embed`, 'Failed to run make backend-embed');
  
  // Copy the binaries to the appropriate location
  binaries.forEach(binary => {
    const srcPath = path.join(cloneDir, binary.src);
    const destPath = path.join(__dirname, binary.dest);
    console.log(`Copying ${srcPath} to ${destPath}...`);
    // runCommand(`pwd`, 'pwd failed');
    // make the directory if it doesn't exist, and check the error and log it if there is
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${path.dirname(destPath)}:`, error.message);
      process.exit(1);
    }

    try {
      fs.copyFileSync(srcPath, destPath);
    } catch (error) {
      console.error(`Failed to copy ${srcPath} to ${destPath}:`, error.message);
      process.exit(1);
    }
  });

  // Clean up repo?
//   console.log('Cleaning up...');
//   runCommand(`rm -rf ${cloneDir}`, 'Failed to clean up the repository');

  console.log('Build and copy completed successfully.');
} catch (error) {
  console.error('An unexpected error occurred:', error.message);
  process.exit(1);
}
// This script updates the package.json to use the actual versions of the optional dependencies
// from their respective package.json files, restoring the non-testing configuration.

const fs = require('fs');
const path = require('path');

// Define the paths to the package.json files of the optional dependencies
const darwinPackageJsonPath = path.join(__dirname, '../packages/backstage-plugin-headlamp-app-darwin-arm64/package.json');
const linuxPackageJsonPath = path.join(__dirname, '../packages/backstage-plugin-headlamp-app-linux-x64-gnu/package.json');
const win32PackageJsonPath = path.join(__dirname, '../packages/backstage-plugin-headlamp-app-win32-x64-msvc/package.json');

// Function to get the version from a package.json file
function getVersion(packageJsonPath) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error(`Failed to read ${packageJsonPath}:`, error.message);
    process.exit(1);
  }
}

// Get the versions from the package.json files
const darwinVersion = getVersion(darwinPackageJsonPath);
const linuxVersion = getVersion(linuxPackageJsonPath);
const win32Version = getVersion(win32PackageJsonPath);

// Define the path to the main package.json file
const packageJsonPath = path.join(__dirname, 'package.json');

// Load the existing package.json content
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  console.error(`Failed to read ${packageJsonPath}:`, error.message);
  process.exit(1);
}

// Update the optionalDependencies for non-testing
packageJson.optionalDependencies = {
  "@headlamp-k8s/backstage-plugin-headlamp-app-darwin-arm64": darwinVersion,
  "@headlamp-k8s/backstage-plugin-headlamp-app-linux-x64-gnu": linuxVersion,
  "@headlamp-k8s/backstage-plugin-headlamp-app-win32-x64-msvc": win32Version
};

// Save the updated package.json content
try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
  console.log(`Updated ${packageJsonPath} with non-testing optionalDependencies.`);
} catch (error) {
  console.error(`Failed to write ${packageJsonPath}:`, error.message);
  process.exit(1);
}

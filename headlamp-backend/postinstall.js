// This script runs after the package is installed. It detects the current platform
// and architecture, then copies the appropriate binary from the optional dependencies
// to the root of the package.

const os = require("os");
const fs = require("fs");
const path = require("path");

/**
 * Run a command and log an error message if it fails.
 *
 * @param {string} command The command to run.
 * @param {string} errorMessage The error message to log if the command fails.
 * @returns {void}
 */
function runCommand(command, errorMessage) {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`${errorMessage}:`, error.message);
    process.exit(1);
  }
}

const platform = os.platform();
const arch = os.arch();
let binaryPath;

if (platform === "darwin" && arch === "arm64") {
  binaryPath = path.join(
    __dirname,
    "node_modules",
    "@headlamp-k8s/backstage-plugin-headlamp-app-darwin-arm64",
    "bin",
    "headlamp-server"
  );
} else if (platform === "linux" && arch === "x64") {
  binaryPath = path.join(
    __dirname,
    "node_modules",
    "@headlamp-k8s/backstage-plugin-headlamp-app-linux-x64-gnu",
    "bin",
    "headlamp-server"
  );
} else if (platform === "win32" && arch === "x64") {
  binaryPath = path.join(
    __dirname,
    "node_modules",
    "@headlamp-k8s/backstage-plugin-headlamp-app-win32-x64-msvc",
    "bin",
    "headlamp-server.exe"
  );
} else {
  console.error("Unsupported platform or architecture");
  process.exit(1);
}

// Target path should use the last part of the binary path,
// so headlamp-server.exe can be used on windows.
const targetPath = path.join(__dirname, path.basename(binaryPath));

fs.copyFileSync(binaryPath, targetPath);
console.log(`Copied ${binaryPath} to ${targetPath}`);

runCommand("node pluginDownload.js", "downloading plugin failed");

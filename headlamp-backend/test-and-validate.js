// This script automates the process of building the binaries, linking the packages, 
// updating the `package.json` for testing, installing dependencies, and validating 
// the presence of the correct binary for the platform. It ensures that the
// `headlamp-server` (or `headlamp-server.exe` on Windows) is present and
// correctly built for the current platform.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

console.error("This test script isn't finished moving from prototype, please test manually for now see README");
process.exit(1);


function runCommand(command, errorMessage) {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`${errorMessage}:`, error.message);
    process.exit(1);
  }
}

try {
  // Build the different binaries
  console.log("Building the different binaries...");
  runCommand("yarn build-headlamps", "Failed to build headlamps");

  // Link all the packages
  console.log("Linking all the packages...");
  runCommand(
    "yarn link ../packages/backstage-plugin-headlamp-app-darwin-arm64",
    "Failed to link darwin package"
  );
  runCommand(
    "yarn link ../packages/backstage-plugin-headlamp-app-linux-x64-gnu",
    "Failed to link linux package"
  );
  runCommand(
    "yarn link ../packages/backstage-plugin-headlamp-app-win32-x64-msvc",
    "Failed to link win32 package"
  );

  runCommand(
    "yarn link backstage-plugin-headlamp-app-darwin-arm64",
    "Failed to link darwin package in main package"
  );
  runCommand(
    "yarn link backstage-plugin-headlamp-app-linux-x64-gnu",
    "Failed to link linux package in main package"
  );
  runCommand(
    "yarn link backstage-plugin-headlamp-app-win32-x64-msvc",
    "Failed to link win32 package in main package"
  );

  // Change package.json for testing
  console.log("Updating package.json for testing...");
  runCommand(
    "node update-package-json-testing.js",
    "Failed to update package.json for testing"
  );

  // Install dependencies
  console.log("Installing dependencies...");
  runCommand("yarn install", "Failed to install dependencies");

  // Validate the presence of the binary
  const binaryName =
    os.platform() === "win32" ? "headlamp-server.exe" : "headlamp-server";
  const binaryPath = path.join(__dirname, binaryName);

  if (fs.existsSync(binaryPath)) {
    console.log(`${binaryName} is present.`);
    runCommand(
      `file ${binaryPath}`,
      `Failed to validate the binary: ${binaryName}`
    );
  } else {
    console.error(`Validation failed: ${binaryName} does not exist.`);
    process.exit(1);
  }

  console.log("Validation successful: The correct binary is present.");
} catch (error) {
  console.error("An unexpected error occurred:", error.message);
  process.exit(1);
}

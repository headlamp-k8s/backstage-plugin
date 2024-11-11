#!/usr/bin/env node
const fs = require("fs");
const http = require("http");
const https = require("https");
const tar = require("tar");
const path = require("path");
const process = require("process");
const os = require('os');

const cwd = process.cwd();
const rootDir = cwd.includes('node_modules') ? process.env.INIT_CWD : cwd;

// Platform detection helpers
const platform = os.platform();
const arch = os.arch();

// Binary download URLs per platform/arch
const BINARY_VERSIONS = {
  win32: {
    x64: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_windows_amd64.exe.tar.gz",
    arm64: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_windows_arm64.exe.tar.gz",
    ia32: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_windows_386.exe.tar.gz"
  },
  darwin: {
    x64: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_darwin_amd64.tar.gz",
    arm64: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_darwin_arm64.tar.gz"
  },
  linux: {
    x64: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_linux_amd64.tar.gz",
    arm64: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_linux_arm64.tar.gz",
    ia32: "https://github.com/headlamp-k8s/backstage-plugin/releases/download/headlamp_standalone_0.26.0-beta-1/headlamp_standalone_0.26.0-beta-1_linux_386.tar.gz"
  }
};

function downloadPlugins() {
  const plugins = {
    backstage:
      "https://github.com/headlamp-k8s/plugins/releases/download/backstage-0.1.0-beta-1/headlamp-k8s-backstage-0.1.0-beta-1.tar.gz",
  };

  const pluginsDir = path.join(rootDir, "plugins");
  console.log("Downloading plugins to:", pluginsDir);

  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  Object.entries(plugins).forEach(([pluginName, pluginUrl]) => {
    console.log(`Downloading ${pluginName} plugin from ${pluginUrl}...`);
    downloadFile(pluginUrl, pluginName, pluginsDir, true);
  });
}

function downloadBinary() {
  const binaryName = platform === 'win32' ? 'headlamp-standalone.exe' : 'headlamp-standalone';
  const binaryDir = path.join(rootDir, 'bin');

  // Validate platform and architecture are supported
  if (!BINARY_VERSIONS[platform]?.[arch]) {
    console.error(`Binary not available for ${platform}-${arch}`);
    return;
  }

  const binaryUrl = BINARY_VERSIONS[platform][arch];
  console.log(`Downloading binary for ${platform}-${arch} to:`, binaryDir);

  if (!fs.existsSync(binaryDir)) {
    fs.mkdirSync(binaryDir, { recursive: true });
  }

  downloadFile(binaryUrl, binaryName, binaryDir, true);
}

function downloadFile(url, name, targetDir, extractTar = true) {
  const client = url.startsWith('https') ? https : http;

  client.get(url, (response) => {
    // Handle redirects
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      console.log("Following redirect...");
      const redirectClient = response.headers.location.startsWith('https') ? https : http;
      redirectClient.get(response.headers.location, (redirectResponse) =>
        handleResponse(redirectResponse, name, targetDir, extractTar)
      );
      return;
    }

    handleResponse(response, name, targetDir, extractTar);
  }).on("error", (err) => {
    console.error(`Error downloading ${name}:`, err);
  });
}

function handleResponse(response, name, targetDir) {
  if (response.statusCode !== 200) {
    console.error(`Failed to download ${name}. Status code: ${response.statusCode}`);
    return;
  }

  const tempFile = path.join(targetDir, `${name}-temp.tar.gz`);
  const fileStream = fs.createWriteStream(tempFile);

  response.pipe(fileStream);

  fileStream.on("finish", () => {
    console.log(`Extracting ${name}...`);
    tar.x({
      file: tempFile,
      cwd: targetDir,
    })
      .then(() => {
        fs.unlinkSync(tempFile);
        // Find and rename the executable file
        const files = fs.readdirSync(targetDir);
        const executableFile = files.find(file => file.includes('headlamp_standalone'));
        if (executableFile) {
          const finalPath = path.join(targetDir, name);
          fs.renameSync(path.join(targetDir, executableFile), finalPath);
          fs.chmodSync(finalPath, '755'); // Ensure executable permissions
        }
        console.log(`${name} downloaded and extracted successfully!`);
      })
      .catch((err) => {
        console.error(`Error extracting ${name}:`, err);
      });
  });
}

// Execute both downloads
downloadPlugins();
downloadBinary();

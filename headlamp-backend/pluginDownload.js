#!/usr/bin/env node
const fs = require("fs");
const https = require("https");
const tar = require("tar");
const path = require("path");

const plugins = {
  backstage:
    "https://github.com/headlamp-k8s/plugins/releases/download/backstage-0.1.0-beta-1/headlamp-k8s-backstage-0.1.0-beta-1.tar.gz",
};
const pluginsDir = path.join(__dirname, "..", "plugins");

// Create plugins directory if it doesn't exist
if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
}

// Download and extract each plugin
Object.entries(plugins).forEach(([pluginName, pluginUrl]) => {
  console.log(`Downloading ${pluginName} plugin from ${pluginUrl}...`);
  https
    .get(pluginUrl, (response) => {
      // Handle redirects
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        console.log("Following redirect...");
        https.get(response.headers.location, (redirectResponse) =>
          handleResponse(redirectResponse, pluginName)
        );
        return;
      }

      handleResponse(response, pluginName);
    })
    .on("error", (err) => {
      console.error(`Error downloading ${pluginName} plugin:`, err);
    });
});

// Modified response handling logic to include plugin name
function handleResponse(response, pluginName) {
  if (response.statusCode !== 200) {
    console.error(
      `Failed to download ${pluginName} plugin. Status code: ${response.statusCode}`
    );
    return;
  }

  // Create write stream for temporary tar file
  const tempFile = path.join(pluginsDir, `${pluginName}-temp.tar.gz`);
  const fileStream = fs.createWriteStream(tempFile);

  response.pipe(fileStream);

  fileStream.on("finish", () => {
    console.log(`Extracting ${pluginName} plugin...`);
    // Extract the tar.gz file
    tar
      .x({
        file: tempFile,
        cwd: pluginsDir,
      })
      .then(() => {
        // Clean up temporary file
        fs.unlinkSync(tempFile);
        console.log(
          `${pluginName} plugin downloaded and extracted successfully!`
        );
      })
      .catch((err) => {
        console.error(`Error extracting ${pluginName} plugin:`, err);
      });
  });
}

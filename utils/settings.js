const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data");
const settingsPath = path.join(dataPath, "settings.json");

// Ensure data directory exists
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath);
}

// Ensure settings file exists
if (!fs.existsSync(settingsPath)) {
  fs.writeFileSync(settingsPath, JSON.stringify({}), "utf8");
}

let settings = {};

try {
  const data = fs.readFileSync(settingsPath, "utf8");
  settings = JSON.parse(data);
} catch (err) {
  console.error("Error reading settings file:", err);
  settings = {};
}

const saveSettings = () => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing settings file:", err);
  }
};

module.exports = {
  getSettings: (guildId) => settings[guildId] || {},
  setSettings: (guildId, newSettings) => {
    settings[guildId] = { ...(settings[guildId] || {}), ...newSettings };
    saveSettings();
  },
  getAllSettings: () => settings,
};

const fs = require("fs");
const path = require("path");
const { stations } = require("../config/radioStations");

const filePath = path.join(__dirname, "..", "config", "radioStations.js");

const saveStations = () => {
  const content =
    "const stations = " +
    JSON.stringify(stations, null, 2) +
    ";\n\nmodule.exports = { stations };\n";

  fs.writeFileSync(filePath, content, "utf8");
};

module.exports = { stations, saveStations };


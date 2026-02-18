const fs = require("fs");
const path = require("path");
const { stations: defaultStations } = require("../config/radioStations");

const DATA_PATH = path.join(__dirname, "..", "data", "radioStations.json");

const ensureDataFile = () => {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, "{}", "utf8");
  }
};

const loadStore = () => {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveStore = (store) => {
  ensureDataFile();
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
};

const getGuildStations = (guildId) => {
  const store = loadStore();
  return store[guildId] || [];
};

const getAllStationsForGuild = (guildId) => {
  const guildStations = getGuildStations(guildId);
  return [...defaultStations, ...guildStations];
};

const addGuildStation = (guildId, station) => {
  const store = loadStore();
  if (!store[guildId]) store[guildId] = [];
  store[guildId].push(station);
  saveStore(store);
  return station;
};

const removeGuildStationByName = (guildId, name) => {
  const store = loadStore();
  const list = store[guildId] || [];
  const index = list.findIndex(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (index === -1) return null;
  const [removed] = list.splice(index, 1);
  store[guildId] = list;
  saveStore(store);
  return removed;
};

const updateGuildStationByName = (guildId, name, patch) => {
  const store = loadStore();
  const list = store[guildId] || [];
  const station = list.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (!station) return null;

  Object.assign(station, patch);
  store[guildId] = list;
  saveStore(store);
  return station;
};

module.exports = {
  defaultStations,
  getAllStationsForGuild,
  getGuildStations,
  addGuildStation,
  removeGuildStationByName,
  updateGuildStationByName,
};


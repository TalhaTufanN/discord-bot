const { stations } = require("../config/stations");

/**
 * Searches for stations by name or tags
 * @param {string} query Search query
 * @param {number} limit Maximum results (Discord limit is 25)
 * @returns {Array} Filtered stations
 */
const searchStations = (query, limit = 25) => {
  if (!query) return stations.slice(0, limit);
  
  const lowerQuery = query.toLowerCase();
  return stations
    .filter(s => 
      s.name.toLowerCase().includes(lowerQuery) || 
      (s.tags && s.tags.toLowerCase().includes(lowerQuery))
    )
    .slice(0, limit);
};

/**
 * Finds a station by its ID
 * @param {string} id Station ID
 * @returns {Object|null} Station object or null
 */
const getStationById = (id) => {
  return stations.find(s => s.id === id) || null;
};

module.exports = {
  searchStations,
  getStationById
};

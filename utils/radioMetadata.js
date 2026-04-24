/**
 * Generic fetcher for Kral Group stations
 */
async function getKralMetadata(radioId, defaultName) {
  try {
    const url = `https://www.kralmuzik.com.tr/rds/mobile?radio_id=${radioId}&_=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    if (data && data.CurrentSong) {
        const artist = data.CurrentSong.ArtistName || defaultName;
        const song = data.CurrentSong.SongName || "Canlı Yayın";
        return { artist, song };
    }
    return null;
  } catch (error) {
    console.error(`${defaultName} Metadata Error:`, error);
    return null;
  }
}

/**
 * Generic function to get metadata based on station name
 */
async function getStationMetadata(stationName) {
  switch (stationName) {
    case "Kral FM":
      return await getKralMetadata(112, "Kral FM");
    case "Kral Pop":
      return await getKralMetadata(113, "Kral Pop");
    // Add other stations here as we find their APIs
    default:
      return null;
  }
}

module.exports = {
  getStationMetadata
};


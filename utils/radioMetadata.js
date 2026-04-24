/**
 * Utilities to fetch live metadata (current song) from radio stations
 */

/**
 * Fetches current song info for Kral FM
 * API URL discovered from their web player
 */
async function getKralFMMetadata() {
  try {
    // We add a timestamp to prevent caching
    const url = `https://www.kralmuzik.com.tr/rds/GetCurrentSongItune?_=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.kralmuzik.com.tr/radyo/kral-fm'
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    // Data structure check: artist and song
    if (data && data.artist && data.song) {
        // Some cleaners if needed (e.g. "REKLAM" check)
        if (data.artist === "REKLAM") return { artist: "Kral FM", song: data.song };
        return { artist: data.artist, song: data.song };
    }
    return null;
  } catch (error) {
    console.error("Kral FM Metadata Error:", error);
    return null;
  }
}

/**
 * Generic function to get metadata based on station name
 */
async function getStationMetadata(stationName) {
  switch (stationName) {
    case "Kral FM":
    case "Kral Pop":
      return await getKralFMMetadata();
    // Add other stations here as we find their APIs
    default:
      return null;
  }
}

module.exports = {
  getKralFMMetadata,
  getStationMetadata
};

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
 * Generic fetcher for Karnaval Group stations (Virgin, JoyTürk, etc.)
 */
async function getKarnavalMetadata(stationId, defaultName) {
  try {
    const url = 'https://karnaval.com/functions/v6/api.functions.php';
    const params = new URLSearchParams();
    params.append('command', 'get_current_song');
    params.append('station_id', 'all');
    params.append('lastVersion', '0');
    params.append('custom_k_parameter', 'karnaval_web_v6');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) return null;
    const json = await response.json();
    
    // Data structure: json.data["station_X"]
    const stationData = json.data && json.data[`station_${stationId}`];
    
    if (stationData) {
        const artist = stationData.artist || defaultName;
        const song = stationData.title || "Canlı Yayın";
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
    case "Süper FM":
      return await getKarnavalMetadata(1, "Süper FM");
    case "Metro FM":
      return await getKarnavalMetadata(2, "Metro FM");
    case "JoyTürk":
      return await getKarnavalMetadata(4, "JoyTürk");
    case "Virgin Radio":
      return await getKarnavalMetadata(15, "Virgin Radio");
    case "JoyTürk Rock":
      return await getKarnavalMetadata(22, "JoyTürk Rock");
    case "Borusan Klasik":
      return await getKarnavalMetadata(11, "Borusan Klasik");
    // Add other stations here as we find their APIs
    default:
      return null;
  }
}

module.exports = {
  getStationMetadata
};


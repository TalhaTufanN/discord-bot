const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function exportFullKarnaval() {
  try {
    const url = 'https://karnaval.com/functions/v6/api.functions.php';
    const params = new URLSearchParams();
    params.append('command', 'get_current_song');
    params.append('station_id', 'all');
    params.append('lastVersion', '0');
    params.append('custom_k_parameter', 'karnaval_web_v6');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const json = await response.json();
    
    // Sadece ID ve "Sanatçı - Şarkı" bilgisini içeren sade bir liste
    const summary = {};
    for (const key in json.data) {
        const s = json.data[key];
        summary[key] = `${s.artist} - ${s.title}`;
    }

    const filePath = path.join(__dirname, '..', 'scratch', 'karnaval_results.txt');
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf8');
    console.log("Dosya başarıyla oluşturuldu: scratch/karnaval_results.txt");
  } catch (error) {
    console.error("Export Error:", error);
  }
}

exportFullKarnaval();

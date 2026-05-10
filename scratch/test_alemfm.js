const https = require('https');

https.get('https://de1.api.radio-browser.info/json/stations/search?name=Alem%20FM&limit=5', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const stations = JSON.parse(data);
      console.log(`Bulunan İstasyon Sayısı: ${stations.length}`);
      stations.forEach((s, i) => {
        console.log(`${i+1}. Adres: ${s.url_resolved}`);
        console.log(`   Format: ${s.codec}`);
      });
    } catch(e) {
      console.log('Hata', e);
    }
  });
});

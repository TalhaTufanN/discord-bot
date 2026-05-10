const https = require('https');

https.get('https://kralpop.radyotvonline.net/stream', (res) => {
  console.log(`Durum Kodu: ${res.statusCode}`);
  console.log(`İçerik Tipi: ${res.headers['content-type']}`);
  
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    console.log(`Yönlendirme adresi: ${res.headers.location}`);
  }
  
  process.exit(0);
}).on('error', (e) => {
  console.error(e);
  process.exit(1);
});

const https = require('https');

const urls = [
  'https://edge1.radyotvonline.net/shoutcast/play/alemfm',
  'https://turkmedya.radyotvonline.net/alemfmaac'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(`\nURL: ${url}`);
    console.log(`Durum Kodu: ${res.statusCode}`);
    console.log(`İçerik Tipi: ${res.headers['content-type']}`);
  }).on('error', e => console.error(e));
});

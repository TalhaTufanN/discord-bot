// PM2 yapilandirmasi. Degerler .env'den okunur; bu dosyada gizli bilgi YOK.
// Not: uretim sunucusunda .env ve muzik arsivi baska klasorde durabilir —
// o durumda bu dosyanin sunucuya ozel bir kopyasi kullanilir (cwd + mutlak
// .env yolu ile). Bu surum depoyu klonlayan biri icin dogru olan surumdur:
// .env kok dizinde, iki bot da ayni kodu calistirir.
require("dotenv").config();

// Iki botun paylastigi ayarlar (farkli olan tek sey token/client id)
const shared = {
  GUILD_ID: process.env.GUILD_ID,
  // Lavalink — bkz. lavalink/application.yml.example
  LAVALINK_HOST: process.env.LAVALINK_HOST || "127.0.0.1",
  LAVALINK_PORT: process.env.LAVALINK_PORT || "2333",
  LAVALINK_PASSWORD: process.env.LAVALINK_PASSWORD,
  // Opsiyonel: bos birakilirsa Spotify calismaz, gerisi normal calisir
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || "",
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || "",
  // Opsiyonel: /sagola icin yerel arsiv yolu (Lavalink ayni makinede olmali)
  SAGOPA_PATH: process.env.SAGOPA_PATH || "",
};

module.exports = {
  apps: [
    {
      name: "raadiotr",
      script: "index.js",
      env: {
        TOKEN: process.env.TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        ...shared,
      },
    },
    {
      // Ikinci bot opsiyonel: .env'de TOKEN2 yoksa bu uygulamayi baslatmayin
      // (pm2 start ecosystem.config.js --only raadiotr)
      name: "raadiotr2",
      script: "index.js",
      env: {
        TOKEN: process.env.TOKEN2,
        CLIENT_ID: process.env.CLIENT_ID2,
        ...shared,
      },
    },
  ],
};

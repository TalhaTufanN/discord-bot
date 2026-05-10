require("dotenv").config();
const { Client } = require("ssh2");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

const ytdlpConfig = `
--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
--force-ipv4
`;

const commands = [
  "mkdir -p /root/.config/yt-dlp",
  "mkdir -p /etc",
  `echo '${ytdlpConfig.trim()}' > /root/.config/yt-dlp/config`,
  `echo '${ytdlpConfig.trim()}' > /etc/yt-dlp.conf`,
  "pm2 restart all"
];

const conn = new Client();
console.log("Sunucuya bağlanılıyor...");

conn.on("ready", () => {
  console.log("Bağlantı kuruldu. Yt-dlp ayar dosyası oluşturuluyor...\n");
  
  conn.exec(commands.join(" && "), (err, stream) => {
    if (err) throw err;
    
    stream.on("close", (code, signal) => {
      console.log(`\nİşlem tamamlandı. (Çıkış Kodu: ${code})`);
      conn.end();
    }).on("data", (data) => {
      process.stdout.write(data.toString());
    }).stderr.on("data", (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on("error", (err) => {
  console.error("SSH Hatası:", err);
}).connect(config);

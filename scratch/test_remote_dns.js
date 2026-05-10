require("dotenv").config();
const { Client } = require("ssh2");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

const commands = [
  "ping -c 3 dygedge2.radyotvonline.net",
  "ping -c 3 vcdn.radyotvonline.net",
  "curl -I https://dygedge2.radyotvonline.net/kralfm/playlist.m3u8",
];

const conn = new Client();
console.log("Sunucuya bağlanılıyor...");

conn.on("ready", () => {
  console.log("Bağlantı kuruldu. Testler başlatılıyor...\n");
  
  conn.exec(commands.join(" && echo '---' && "), (err, stream) => {
    if (err) throw err;
    
    stream.on("close", (code, signal) => {
      console.log(`\nTest tamamlandı. (Çıkış Kodu: ${code})`);
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

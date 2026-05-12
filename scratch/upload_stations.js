require("dotenv").config();
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

const LOCAL_PATH = path.join(__dirname, "..", "config", "stations.js");
const REMOTE_PATH = "/root/discord-bot/config/stations.js";

const conn = new Client();
console.log("Sunucuya bağlanılıyor (Dosya yükleme için)...");

conn.on("ready", () => {
  console.log("Bağlantı kuruldu. Veri paketi gönderiliyor...");
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const readStream = fs.createReadStream(LOCAL_PATH);
    const writeStream = sftp.createWriteStream(REMOTE_PATH);
    
    writeStream.on("close", () => {
      console.log("\n✅ Başarılı! Dev radyo listesi sunucuya güvenli bir şekilde yüklendi.");
      conn.end();
    });
    
    writeStream.on("error", (err) => {
      console.error("Yükleme hatası:", err);
      conn.end();
    });
    
    readStream.pipe(writeStream);
  });
}).on("error", (err) => {
  console.error("SSH Hatası:", err);
}).connect(config);

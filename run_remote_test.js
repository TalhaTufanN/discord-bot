require("dotenv").config();
const { Client } = require("ssh2");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

const conn = new Client();
conn
  .on("ready", () => {
    console.log("Connected. Running test-voice.js on remote server...");
    conn.exec("cd /root/discord-bot && node test-voice.js", (err, stream) => {
      if (err) throw err;
      stream
        .on("close", (code) => {
          console.log("\nFinished with code:", code);
          conn.end();
        })
        .on("data", (data) => {
          process.stdout.write(data);
        })
        .stderr.on("data", (data) => {
          process.stderr.write("ERR: " + data);
        });
    });
  })
  .on("error", (err) => {
    console.error("SSH Error:", err);
  })
  .connect(config);

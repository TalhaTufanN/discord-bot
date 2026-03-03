require("dotenv").config();
const { Client } = require("ssh2");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

console.log("Connecting to remote server to stop bots...");
const conn = new Client();

conn
  .on("ready", () => {
    console.log("Connected! Stopping pm2 processes...");
    conn.exec("pm2 stop all", (err, stream) => {
      if (err) throw err;
      stream
        .on("close", (code, signal) => {
          console.log(`Command finished with exit code: ${code}`);
          conn.end();
        })
        .on("data", (data) => {
          process.stdout.write("[REMOTE] " + data);
        })
        .stderr.on("data", (data) => {
          process.stderr.write("[REMOTE ERR] " + data);
        });
    });
  })
  .on("error", (err) => {
    console.error("SSH Connection Error:", err);
  })
  .connect(config);

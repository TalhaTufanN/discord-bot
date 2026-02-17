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
    console.log("Connected to server for logs...");
    conn.exec("pm2 logs raadiotr --lines 100 --nostream", (err, stream) => {
      if (err) throw err;
      stream
        .on("close", () => {
          console.log("\nLog stream closed.");
          conn.end();
        })
        .on("data", (data) => {
          process.stdout.write(data);
        })
        .stderr.on("data", (data) => {
          process.stderr.write(data);
        });
    });
  })
  .on("error", (err) => {
    console.error("SSH Error:", err);
  })
  .connect(config);

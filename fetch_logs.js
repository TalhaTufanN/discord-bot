require("dotenv").config();
const { Client } = require("ssh2");
const fs = require("fs");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

const conn = new Client();
let output = "";

conn
  .on("ready", () => {
    conn.exec("pm2 logs raadiotr --lines 200 --nostream", (err, stream) => {
      if (err) throw err;
      stream
        .on("close", () => {
          fs.writeFileSync("pm2-remote-logs.txt", output, "utf8");
          console.log("Logs saved to pm2-remote-logs.txt");
          conn.end();
        })
        .on("data", (data) => {
          output += data;
        })
        .stderr.on("data", (data) => {
          output += data;
        });
    });
  })
  .on("error", (err) => {
    console.error("SSH Error:", err);
  })
  .connect(config);

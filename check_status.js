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
    conn.exec("pm2 jlist", (err, stream) => {
      if (err) throw err;
      let output = "";
      stream
        .on("close", () => {
          conn.end();
          try {
            const data = JSON.parse(output);
            data.forEach((app) => {
              console.log(
                `${app.name}: ${app.pm2_env.status} (Restarts: ${app.pm2_env.restart_time}, Uptime: ${Math.round((Date.now() - app.pm2_env.pm_uptime) / 1000 / 60)} mins)`,
              );
            });
          } catch (e) {
            console.log("Raw output:", output);
          }
        })
        .on("data", (data) => {
          output += data;
        });
    });
  })
  .on("error", (err) => {
    console.error("SSH Error:", err);
  })
  .connect(config);

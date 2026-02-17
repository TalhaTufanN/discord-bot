require("dotenv").config();
const { Client } = require("ssh2");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

const serverEnvVars = [
  `TOKEN2=${process.env.TOKEN2}`,
  `CLIENT_ID2=${process.env.CLIENT_ID2}`,
];

const conn = new Client();
conn
  .on("ready", () => {
    console.log("Connected to server to sync .env...");

    // Script to append vars if they don't exist
    const syncCommand = serverEnvVars
      .map((v) => {
        const key = v.split("=")[0];
        return `grep -q "^${key}=" .env || echo "${v}" >> .env`;
      })
      .join(" && ");

    conn.exec(`cd /root/discord-bot && ${syncCommand}`, (err, stream) => {
      if (err) throw err;
      stream
        .on("close", (code) => {
          console.log(
            `Sync finished with code ${code}. Retrying deployment...`,
          );
          conn.end();
        })
        .on("data", (data) => process.stdout.write(data))
        .stderr.on("data", (data) => process.stderr.write(data));
    });
  })
  .on("error", (err) => {
    console.error("SSH Error:", err);
  })
  .connect(config);

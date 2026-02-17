require("dotenv").config();
const { Client } = require("ssh2");
const { exec } = require("child_process");

const config = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};

const commands = [
  "cd /root/discord-bot",
  "git fetch --all",
  "git reset --hard origin/main", // Force sync with GitHub
  "npm install --production", // Install dependencies (might overwrite patch)
  // CRITICAL PATCH: Remove 'noCallHome: true' to fix yt-dlp crash
  "sed -i '/noCallHome: true,/d' node_modules/@distube/yt-dlp/dist/index.js",
  "pm2 restart raadiotr --update-env",
  "pm2 logs raadiotr --lines 20 --nostream", // Show logs
];

function runLocalCommand(cmd) {
  return new Promise((resolve, reject) => {
    console.log(`[LOCAL] Executing: ${cmd}`);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(`[LOCAL] Warning/Error: ${error.message}`);
        // resolve anyway to keep going (e.g. if nothing to commit)
        resolve(stdout);
      } else {
        console.log(stdout);
        resolve(stdout);
      }
    });
  });
}

async function deploy() {
  console.log("🚀 Starting Deployment...");

  // 1. Local Git Sync
  console.log("📦 Syncing local changes to GitHub...");
  try {
    await runLocalCommand("git add .");
    await runLocalCommand('git commit -m "feat: auto-deploy update"');
    await runLocalCommand("git push");
  } catch (e) {
    console.error("Git sync failed:", e);
    // Continue? Maybe user pushed manually.
  }

  // 2. Remote Update
  console.log("📡 Connecting to Remote Server...");
  const conn = new Client();

  conn
    .on("ready", () => {
      console.log("✅ Connected! Executing update scripts...");

      const fullCommand = commands.join(" && ");

      conn.exec(fullCommand, (err, stream) => {
        if (err) throw err;

        stream
          .on("close", (code, signal) => {
            console.log(`\n✨ Deployment Finished! (Exit Code: ${code})`);
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
}

deploy();

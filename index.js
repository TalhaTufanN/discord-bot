require("node:dns").setDefaultResultOrder("ipv4first");
const net = require("node:net");
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
// const { SoundCloudPlugin } = require("@distube/soundcloud");
const { YouTubePlugin } = require("@distube/youtube");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const { emojis } = require("./config/emojis");

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Create collections for commands
client.commands = new Collection();

// Parse cookies from Netscape format (cookies.txt) for YouTubePlugin
function parseNetscapeCookies() {
  const possiblePaths = [
    path.join(__dirname, "cookies.txt"),
    "/root/.config/yt-dlp/cookies.txt",
    path.join("/root", ".config", "yt-dlp", "cookies.txt")
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      try {
        console.log(`[Cookies] Reading cookies from: ${filePath}`);
        const content = fs.readFileSync(filePath, "utf8");
        const cookies = [];
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const parts = trimmed.split("\t");
          if (parts.length < 7) continue;
          cookies.push({
            domain: parts[0],
            path: parts[2],
            secure: parts[3] === "TRUE",
            expirationDate: parseInt(parts[4], 10),
            name: parts[5],
            value: parts[6],
          });
        }
        if (cookies.length > 0) {
          console.log(`[Cookies] Successfully parsed ${cookies.length} cookies!`);
          return cookies;
        }
      } catch (err) {
        console.error(`[Cookies] Error parsing ${filePath}:`, err);
      }
    }
  }
  console.log("[Cookies] No valid cookies.txt found in search paths.");
  return undefined;
}

const ytCookies = parseNetscapeCookies();

const ytDlpPlugin = new YtDlpPlugin({ update: false });
const youtubePlugin = new YouTubePlugin({ cookies: ytCookies });

// Capture the original ytDlp getStreamURL method
const originalYtDlpGetStreamURL = ytDlpPlugin.getStreamURL.bind(ytDlpPlugin);

// Helper for self-healing streaming
async function getStreamURLWithFallback(song) {
  console.log(`[Streaming] Resolving stream for "${song.name}" (${song.url || 'No URL'})`);
  try {
    return await originalYtDlpGetStreamURL(song);
  } catch (err) {
    const errMsg = err.message || String(err);
    const isBotOrRestrict = 
      errMsg.includes("Sign in") || 
      errMsg.includes("LOGIN_REQUIRED") || 
      errMsg.includes("confirm you're not a bot") || 
      errMsg.includes("bot") ||
      errMsg.includes("formats");
      
    if (isBotOrRestrict) {
      console.log(`[Streaming Alert] "${song.name}" is age-restricted or blocked by YouTube. Searching for clean fallback audio...`);
      try {
        const query = `${song.name} Audio`;
        const results = await client.distube.search(query, { limit: 5 });
        for (const result of results) {
          if (result.id === song.id) continue;
          try {
            console.log(`[Streaming Fallback] Attempting clean version: "${result.name}" (${result.url})`);
            const fallbackUrl = await originalYtDlpGetStreamURL(result);
            if (fallbackUrl) {
              console.log(`[Streaming Fallback] SUCCESS! Playing non-restricted version: "${result.name}"`);
              return fallbackUrl;
            }
          } catch (fallbackErr) {
            console.log(`[Streaming Fallback] Clean version "${result.name}" failed: ${fallbackErr.message || fallbackErr}`);
          }
        }
      } catch (searchErr) {
        console.error("[Streaming Fallback] Search failed:", searchErr.message || searchErr);
      }
    }
    throw err;
  }
}

// Override getStreamURL for BOTH plugins to use our self-healing fallback mechanism
ytDlpPlugin.getStreamURL = getStreamURLWithFallback;
youtubePlugin.getStreamURL = getStreamURLWithFallback;

// Initialize DisTube
const ffmpegPath = require("ffmpeg-static");
client.distube = new DisTube(client, {
  emitNewSongOnly: true,
  ffmpeg: {
    args: {
      input: [
        "-reconnect", "1",
        "-reconnect_at_eof", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5"
      ]
    }
  },
  plugins: [
    new SpotifyPlugin({}),
    ytDlpPlugin,
    youtubePlugin,
  ],
});

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));
const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

// Deploy slash commands
const deployCommands = async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );
    console.log(`Commands to load: ${commands.map((c) => c.name).join(", ")}`);

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(process.env.TOKEN);

    // Support multiple Guild IDs (comma separated in .env)
    const guildIds = process.env.GUILD_ID.split(",").map((id) => id.trim());

    for (const guildId of guildIds) {
      if (!guildId) continue;

      // Deploy Guild Commands (Instant update)
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands },
      );
      console.log(
        `[${guildId}] Successfully reloaded ${data.length} guild application (/) commands.`,
      );
    }

    // Clear global commands (to prevent duplicates) - uncomment if needed
    // await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    //   body: [],
    // });
  } catch (error) {
    console.error("Error deploying commands:", error);
  }
};

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// DisTube events
const { handleDistubeEvents } = require("./utils/distubeEvents");
handleDistubeEvents(client);

// Deploy commands and then log in to Discord
(async () => {
  await deployCommands();
  client.login(process.env.TOKEN);
})();

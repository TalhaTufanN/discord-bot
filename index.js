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
const { YouTubePlugin } = require("@distube/youtube");
// const { SoundCloudPlugin } = require("@distube/soundcloud");
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

// Initialize DisTube
const ffmpegPath = require("ffmpeg-static");
client.distube = new DisTube(client, {
  emitNewSongOnly: true,
  plugins: [
    new YouTubePlugin(),
    new SpotifyPlugin({}),
    new YtDlpPlugin({ update: false }),
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

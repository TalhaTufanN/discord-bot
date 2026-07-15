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
  Events,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { createLavalink } = require("./utils/lavalink");

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

// --- Process seviyesi hata yakalayicilar ---
// Yakalanmayan bir promise reddi/hatasi tum botu dusurup pm2'yi crash-loop'a
// sokmasin diye burada logluyoruz. Bot cok sunucuya hizmet ettiginden basibos
// bir hata yuzunden komple olmesini istemiyoruz.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

// --- Gateway saglik izleme ---
// "pm2'de online ama Discord'da offline" (donma) durumunu tespit/toparlamak icin.
client.on(Events.ShardError, (error, shardId) => {
  console.error(`[Gateway] Shard ${shardId} hata:`, error?.message || error);
});
client.on(Events.ShardDisconnect, (event, shardId) => {
  console.warn(
    `[Gateway] Shard ${shardId} baglanti kesildi (kod: ${event?.code}). Yeniden baglanmaya calisiliyor...`,
  );
});
client.on(Events.ShardReconnecting, (shardId) => {
  console.warn(`[Gateway] Shard ${shardId} yeniden baglaniyor...`);
});
client.on(Events.ShardResume, (shardId, replayed) => {
  console.log(`[Gateway] Shard ${shardId} oturum devam ettirildi (${replayed} olay tekrar oynatildi).`);
});
client.on("error", (error) => {
  console.error("[Client] Hata:", error?.message || error);
});
// Oturum kalici olarak gecersiz kilindiginda discord.js kendini toparlayamaz;
// temiz bir restart icin cikiyoruz (pm2 yeniden baslatir).
client.on(Events.Invalidated, () => {
  console.error("[Gateway] Oturum gecersiz kilindi. Temiz restart icin cikiliyor...");
  process.exit(1);
});

// --- Ses katmani: Lavalink ---
// DisTube + yt-dlp + cookie/PO-token mucadelesinin tamami buradan kalkti.
// Eskiden her sarki icin 2-4 yt-dlp (Python) sureci spawn ediliyordu; artik
// cozum de stream de Lavalink'ten geliyor (VPS olcumu: ses baslangici ~988 ms).
client.lavalink = createLavalink(client);

client.lavalink.nodeManager.on("connect", (node) =>
  console.log(`[Lavalink] Node bagli: ${node.id}`),
);
client.lavalink.nodeManager.on("error", (node, error) =>
  console.error(`[Lavalink] Node hatasi (${node.id}):`, error?.message || error),
);
client.lavalink.nodeManager.on("disconnect", (node, reason) =>
  console.warn(
    `[Lavalink] Node baglantisi kesildi (${node.id}):`,
    reason?.reason || reason || "",
  ),
);
client.lavalink.nodeManager.on("reconnecting", (node) =>
  console.warn(`[Lavalink] Node yeniden baglaniyor: ${node.id}`),
);

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

// Lavalink events (eski utils/distubeEvents.js'in yerine)
const { handleLavalinkEvents } = require("./utils/lavalinkEvents");
handleLavalinkEvents(client);

// Lavalink manager'i bot girisi tamamlaninca baslat — node'a baglanmak icin
// bot kullanici id'si gerekiyor.
let lavalinkStarted = false;
const startLavalink = async () => {
  if (lavalinkStarted) return;
  lavalinkStarted = true;
  try {
    await client.lavalink.init({
      id: client.user.id,
      username: client.user.username,
    });
  } catch (error) {
    console.error("[Lavalink] init basarisiz:", error?.message || error);
  }
};
// discord.js v14 "ready" -> v15 "clientReady"; ikisini de dinleyip tek sefer calistiriyoruz
client.once(Events.ClientReady, startLavalink);
client.once("clientReady", startLavalink);

// Deploy commands and then log in to Discord
(async () => {
  await deployCommands();
  client.login(process.env.TOKEN);
})();

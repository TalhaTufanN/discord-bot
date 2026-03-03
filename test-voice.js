require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  // Find the first voice channel available to join
  let targetChannel = null;
  for (const guild of client.guilds.cache.values()) {
    const channels = await guild.channels.fetch();
    targetChannel = channels.find((c) => c.isVoiceBased());
    if (targetChannel) break;
  }

  if (!targetChannel) {
    console.log("No voice channel found to test.");
    process.exit(1);
  }

  console.log(
    `Testing connection to voice channel: ${targetChannel.name} in ${targetChannel.guild.name}`,
  );

  try {
    const connection = joinVoiceChannel({
      channelId: targetChannel.id,
      guildId: targetChannel.guild.id,
      adapterCreator: targetChannel.guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Signalling, () =>
      console.log("State: Signalling"),
    );
    connection.on(VoiceConnectionStatus.Connecting, () =>
      console.log("State: Connecting"),
    );
    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("State: Ready! Voice connection successful.");
      process.exit(0);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () =>
      console.log("State: Disconnected"),
    );

    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
});

client.login(process.env.TOKEN);

const { Events, ActivityType } = require("discord.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`Hazır! ${client.user.tag} olarak giriş yapıldı`);

    // Set bot activity
    client.user.setActivity("/çal | /radyo", { type: ActivityType.Listening });

    console.log(`Bot ${client.guilds.cache.size} sunucuda aktif`);
  },
};

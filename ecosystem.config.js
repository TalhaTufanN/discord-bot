require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "raadiotr",
      script: "index.js",
      env: {
        TOKEN: process.env.TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        GUILD_ID: process.env.GUILD_ID,
      },
    },
    {
      name: "raadiotr2",
      script: "index.js",
      env: {
        TOKEN: process.env.TOKEN2,
        CLIENT_ID: process.env.CLIENT_ID2,
        GUILD_ID: process.env.GUILD_ID,
      },
    },
  ],
};

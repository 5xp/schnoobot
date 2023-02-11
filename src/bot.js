require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { Client, GatewayIntentBits } = require("discord.js");
const loadCommands = require("./load-commands.js");
const EconomyManager = require("./EconomyManager.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers],
  rest: {
    timeout: 80_000,
  },
});
loadCommands(client);

client.economy = new EconomyManager();

// Add listeners
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.login();

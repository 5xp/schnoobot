const fs = require("node:fs");
const path = require("node:path");
const { Collection } = require("discord.js");

module.exports = client => {
  client.commands = new Collection();

  const commandsPath = path.join(__dirname, "commands");

  readCommands(commandsPath, client);
};

function readCommands(dir, client) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);

    if (stat.isDirectory()) {
      readCommands(filePath, client);
    } else if (file.endsWith(".js")) {
      const command = require(filePath);

      if (!("data" in command && "execute" in command)) {
        continue;
      }

      client.commands.set(command.data.name, command);
    }
  }
}

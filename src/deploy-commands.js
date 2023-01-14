require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const deployGlobal = args.includes("--global");

const commands = [];

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

      commands.push(command.data.toJSON());
    }
  }
}

// Grab all the command files from the commands directory you created earlier
const commandsPath = path.join(__dirname, "commands");

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
readCommands(commandsPath);

// Construct and prepare an instance of the REST module
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    let data;

    // The put method is used to fully refresh all commands in the guild with the current set
    if (deployGlobal) {
      console.log("Deploying global commands.");
      data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    } else {
      console.log("Deploying guild commands.");
      data = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
        body: commands,
      });
    }

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();

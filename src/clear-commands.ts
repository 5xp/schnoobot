import { REST, Routes } from "discord.js";
import { ENV } from "env";

const args = process.argv.slice(2);
const clearGlobal = args.includes("--global");

const token = ENV.DISCORD_TOKEN;
const clientId = ENV.CLIENT_ID;
const guildId = ENV.GUILD_ID;

if (!guildId && !clearGlobal) {
  throw new Error("Guild ID not found in environment variables.");
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    if (clearGlobal) {
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log("Successfully cleared global commands.");
    } else {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId!), { body: [] });
      console.log("Successfully cleared guild commands.");
    }
  } catch (error) {
    console.error(error);
  }
})();

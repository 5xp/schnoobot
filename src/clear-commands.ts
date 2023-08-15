import { config } from "dotenv";
import { resolve } from "path";
import { REST, Routes } from "discord.js";

config({ path: resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const clearGlobal = args.includes("--global");

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("Token not found in environment variables.");
}

const clientId = process.env.CLIENT_ID;
if (!clientId) {
  throw new Error("Client ID not found in environment variables.");
}

const guildId = process.env.GUILD_ID;
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

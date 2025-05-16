import ExtendedClient from "@common/ExtendedClient";
import { ENV } from "env";

const args = process.argv.slice(2);
const global = args.includes("--global");

const guildId = ENV.GUILD_ID;

if (!global && !guildId) {
	throw new Error("Guild ID not found in environment variables.");
}

const options = global ? { global } : { global, guildId: guildId! };

ExtendedClient.clearCommands(options).then(console.log).catch(console.error);

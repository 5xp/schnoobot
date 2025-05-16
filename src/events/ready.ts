import ExtendedClient from "@common/ExtendedClient";
import { Events } from "discord.js";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: ExtendedClient) {
		console.log(`Logged in as ${client.user?.tag}!`);
		await client.application?.fetch();
		await client.loadEmojis(client);
	},
};

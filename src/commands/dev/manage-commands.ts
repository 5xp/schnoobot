import ExtendedClient from "@common/ExtendedClient";
import { errorMessage, simpleEmbed } from "@common/reply-utils";
import { ChatInputCommandInteraction } from "discord.js";
import { ENV } from "env";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
	const global = interaction.options.getBoolean("global") ?? false;
	const guildId = interaction.options.getString("guild") ?? ENV.GUILD_ID;

	if (!global && !guildId) {
		interaction.reply(errorMessage("No guild ID provided."));
		return;
	}

	const options = global ? { global } : { global, guildId: guildId! };

	const fn =
		interaction.options.getSubcommand() === "deploy" ? ExtendedClient.deployCommands : ExtendedClient.clearCommands;

	const result = await fn.call(ExtendedClient, options);

	interaction.reply({ embeds: [simpleEmbed(result)], ephemeral: true });
}

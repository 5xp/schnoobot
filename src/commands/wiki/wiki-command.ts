import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from "discord.js";
import { autocomplete } from "./autocomplete";
import { execute } from "./handleInteraction";
import { supportedWikis } from "./Wiki";

export default {
	data: new SlashCommandBuilder()
		.setName("wiki")
		.setDescription("Search a wiki")
		.addStringOption(option => {
			option.setName("name").setDescription("The name of the wiki to search").setRequired(true);

			const choices = Array.from(supportedWikis.entries()).map(([wikiKey, wiki]) => ({
				name: wiki.name,
				value: wikiKey,
			}));

			option.addChoices(...choices);

			return option;
		})
		.addStringOption(option =>
			option.setName("query").setDescription("The query to search for").setRequired(true).setAutocomplete(true),
		)
		.addBooleanOption(option =>
			option.setName("hide").setDescription("Make the response ephemeral").setRequired(false),
		)
		.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
		.setContexts([
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		]),
	execute,
	autocomplete,
};

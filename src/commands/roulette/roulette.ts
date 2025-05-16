import ExtendedClient from "@common/ExtendedClient";
import {
	ApplicationIntegrationType,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("roulette")
		.setDescription("Get a random post from a social media platform or forum")
		.addSubcommand(subcommand =>
			subcommand
				.setName("4chan")
				.setDescription("Get a random post from a 4chan board")
				.addStringOption(option =>
					option
						.setName("board")
						.setDescription("The board to get a post from")
						.setRequired(true)
						.setAutocomplete(true),
				)
				.addStringOption(option =>
					option
						.setName("thread")
						.setDescription("Search for a thread")
						.setAutocomplete(true)
						.setRequired(false),
				)
				.addStringOption(option =>
					option
						.setName("type")
						.setDescription("The type of post to get. Defaults to images + videos")
						.addChoices(
							{ name: "All", value: "all" },
							{ name: "Images + Videos", value: "image" },
							{ name: "Videos", value: "video" },
						)
						.setRequired(false),
				),
		)
		.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
		.setContexts([
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		]),
	// .addSubcommand(subcommand =>
	//   subcommand
	//     .setName("reddit")
	//     .setDescription("Get a random post from a subreddit or user")
	//     .addStringOption(option =>
	//       option
	//         .setName("query")
	//         .setDescription("The subreddit or user to get a post from. If a user, format your query as u/username")
	//         .setRequired(true),
	//     )
	//     .addStringOption(option =>
	//       option
	//         .setName("timeframe")
	//         .setDescription("The timeframe to get the post from")
	//         .addChoices(
	//           { name: "All", value: "all" },
	//           { name: "Year", value: "year" },
	//           { name: "Month", value: "month" },
	//           { name: "Week", value: "week" },
	//           { name: "Day", value: "day" },
	//         )
	//         .setRequired(false),
	//     )
	//     .addBooleanOption(option =>
	//       option.setName("exclude-text").setDescription("Exclude text posts").setRequired(false),
	//     ),
	// )
	// .addSubcommand(subcommand =>
	//   subcommand
	//     .setName("twitter")
	//     .setDescription("Get a random tweet from a user")
	//     .addStringOption(option =>
	//       option.setName("user").setDescription("The user to get a tweet from").setRequired(true),
	//     )
	//     .addBooleanOption(option =>
	//       option.setName("media-only").setDescription("Only include tweets with media").setRequired(false),
	//     ),
	// )
	// .addSubcommand(subcommand =>
	//   subcommand
	//     .setName("tiktok")
	//     .setDescription("Get a random TikTok video from a user")
	//     .addStringOption(option =>
	//       option.setName("user").setDescription("The user to get a video from").setRequired(true),
	//     ),
	// )

	async autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
		const subcommand = interaction.options.getSubcommand();

		const commandPath = `./${subcommand}`;
		const commandModule = await import(commandPath);
		const autocomplete = commandModule.autocomplete;

		autocomplete(interaction, client);
	},
	async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
		const subcommand = interaction.options.getSubcommand();

		const commandPath = `./${subcommand}`;
		const commandModule = await import(commandPath);
		const execute = commandModule.default;

		execute(interaction, client);
	},
};

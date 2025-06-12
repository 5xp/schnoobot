import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { ChatInputCommandInteraction, ClientApplication, SlashCommandBuilder } from "discord.js";

export default {
	devOnly: true,
	data: new SlashCommandBuilder()
		.setName("dev")
		.setDescription("Developer commands")
		.addSubcommand(subcommand => subcommand.setName("run-code").setDescription("Run code"))
		.addSubcommand(subcommand => subcommand.setName("update-ytdlp").setDescription("Update youtube-dl"))
		.addSubcommand(subcommand =>
			subcommand
				.setName("info")
				.setDescription("Get information about a file from the internet")
				.addStringOption(option =>
					option
						.setName("url")
						.setDescription("The URL of the file to get information about")
						.setRequired(true),
				),
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName("manage-commands")
				.setDescription("Manage commands")
				.addSubcommand(subcommand =>
					subcommand
						.setName("deploy")
						.setDescription("Deploy commands")
						.addBooleanOption(option =>
							option.setName("global").setDescription("Deploy commands globally").setRequired(false),
						)
						.addStringOption(option =>
							option
								.setName("guild")
								.setDescription(
									"The ID of the guild to deploy to. Leave empty to deploy to guild in ENV.",
								)
								.setRequired(false),
						),
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName("clear")
						.setDescription("Clear commands")
						.addBooleanOption(option =>
							option.setName("global").setDescription("Clear commands globally").setRequired(false),
						)

						.addStringOption(option =>
							option
								.setName("guild")
								.setDescription("The ID of the guild to clear. Leave empty to clear guild in ENV.")
								.setRequired(false),
						),
				),
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName("cookies")
				.setDescription("Manage the cookies file")
				.addSubcommand(subcommand => subcommand.setName("get").setDescription("Get the cookies file"))
				.addSubcommand(subcommand =>
					subcommand
						.setName("upload")
						.setDescription("Upload a new cookies file")
						.addAttachmentOption(option =>
							option.setName("file").setDescription("The cookies file to upload"),
						),
				),
		),
	async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
		if (!isDev(client.application, interaction.user.id)) {
			await interaction.reply(errorMessage("Only the bot owner can use this command."));

			return;
		}

		const subcommandGroup = interaction.options.getSubcommandGroup();
		const subcommand = interaction.options.getSubcommand();

		const commandPath = subcommandGroup ? `./${subcommandGroup}` : `./${subcommand}`;
		const commandModule = await import(commandPath);
		const execute = commandModule.default;

		execute(interaction, client);
	},
};

function isDev(application: ClientApplication | null, userId: string): boolean {
	if (!application) {
		return false;
	}

	const owner = application.owner;

	if (owner === null) {
		return false;
	}

	// Check if the owner is a team
	if ("members" in owner) {
		return owner.members.some(member => member.user.id === userId);
	}

	return owner.id === userId;
}

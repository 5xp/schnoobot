import { errorContainerMessage } from "@common/reply-utils";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ContainerBuilder,
	InteractionContextType,
	MessageComponentInteraction,
	MessageFlags,
	PermissionFlagsBits,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	TextDisplayBuilder,
	inlineCode,
} from "discord.js";
import { z } from "zod";

const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export default {
	data: new SlashCommandBuilder()
		.setName("create-emoji")
		.setDescription("Create an emoji")
		.addSubcommand(subcommand =>
			subcommand
				.setName("url")
				.setDescription("Create an emoji from a URL")
				.addStringOption(option =>
					option.setName("url").setDescription("The URL of the emoji").setRequired(true),
				)
				.addStringOption(option =>
					option
						.setName("name")
						.setDescription("The name of the emoji")
						.setRequired(true)
						.setMinLength(2)
						.setMaxLength(32),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("attachment")
				.setDescription("Create an emoji from an attachment")
				.addAttachmentOption(option =>
					option.setName("image").setDescription("The image of the emoji").setRequired(true),
				)
				.addStringOption(option =>
					option
						.setName("name")
						.setDescription("The name of the emoji")
						.setRequired(true)
						.setMinLength(2)
						.setMaxLength(32),
				),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
		.setContexts(InteractionContextType.Guild),
	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		if (!interaction.inCachedGuild()) {
			await interaction.reply(errorContainerMessage("This command can only be used in a server."));
			return;
		}

		if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageGuildExpressions)) {
			await interaction.reply(
				errorContainerMessage(`I don't have ${inlineCode("Manage Emojis and Stickers")} permissions!`),
			);
			return;
		}

		const name = interaction.options.getString("name", true);

		if (name.includes(" ")) {
			await interaction.reply(errorContainerMessage("The name of the emoji cannot contain spaces."));
			return;
		}

		const subcommand = subcommandTypes.parse(interaction.options.getSubcommand());

		let url: string;

		switch (subcommand) {
			case "attachment": {
				const attachment = interaction.options.getAttachment("image", true);

				if (!allowedExtensions.some(extension => attachment.name.endsWith(extension))) {
					await interaction.reply(errorContainerMessage("The attachment must be an image."));
					return;
				}

				url = attachment.url;

				break;
			}

			case "url":
				url = interaction.options.getString("url", true);
		}

		await interaction.deferReply();

		const emoji = await interaction.guild.emojis
			.create({ attachment: url, name, reason: `Requested by ${interaction.user.tag}` })
			.catch(error => {
				console.error(error);

				const errorResult = errorSchema.safeParse(error);
				const errorString = errorResult.success ? errorResult.data.rawError.message : "Unknown error";

				interaction.editReply(
					errorContainerMessage(`There was an error trying to create the emoji: ${inlineCode(errorString)}`),
				);
			});

		if (!emoji) {
			return;
		}

		const container = new ContainerBuilder();

		const deleteButton = new ButtonBuilder()
			.setCustomId("delete")
			.setLabel("Delete")
			.setStyle(ButtonStyle.Secondary);
		const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton);

		// TODO: Regression in components v2: animated webp is not supported.
		// When this regression is fixed, update this to use thumbnail component.
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`Created a new emoji`),
			new TextDisplayBuilder().setContent(`# ${emoji}`),
		);
		container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
		container.addActionRowComponents(actionRow);

		const response = await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
		const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
		const componentInteraction = await response.awaitMessageComponent({ filter, time: 60_000 }).catch(() => null);

		if (!componentInteraction || componentInteraction.customId !== "delete") {
			return;
		}

		await interaction.deleteReply();

		const deleted = await emoji.delete(`Deleted by ${interaction.user.tag}`).catch(error => {
			console.error(error);

			const errorResult = errorSchema.safeParse(error);
			const errorString = errorResult.success ? errorResult.data.rawError.message : "Unknown error";

			interaction.followUp(
				errorContainerMessage(`There was an error trying to delete the emoji: ${inlineCode(errorString)}`),
			);
		});

		if (!deleted) {
			return;
		}

		await componentInteraction.reply({
			content: `The emoji ${inlineCode(name)} has been deleted.`,
			ephemeral: true,
		});
	},
};

const errorSchema = z.object({
	rawError: z.object({
		message: z.string(),
	}),
});

const subcommandTypes = z.union([z.literal("url"), z.literal("attachment")]);

import ExtendedClient from "@common/ExtendedClient";
import { errorContainerMessage, errorMessage, simpleContainer } from "@common/reply-utils";
import { setAniListAccessToken } from "@db/services";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	Colors,
	ComponentType,
	ContainerBuilder,
	MessageComponentInteraction,
	MessageFlags,
	ModalBuilder,
	SectionBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import { ENV } from "env";
import { getAccessToken } from "./anime.services";

const AUTHENTICATION_TIMEOUT = 300_000;

export default async function execute(
	interaction: ChatInputCommandInteraction | MessageComponentInteraction,
	client: ExtendedClient,
	cameFromOtherAction = false,
) {
	const { ANILIST_CLIENT_ID: clientId, ANILIST_REDIRECT_URI: redirectUri } = ENV;

	if (!clientId || !redirectUri) {
		await interaction.reply(errorMessage("AniList credentials are not configured"));
		return;
	}

	if (!interaction.deferred) {
		await interaction.deferReply({
			flags: MessageFlags.Ephemeral,
		});
	}

	let hasConnected = false;

	const container = new ContainerBuilder();

	if (cameFromOtherAction) {
		container.addSectionComponents(
			new SectionBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent("**This action requires you to connect your AniList account.**"),
			),
		);
		container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));
	}

	const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
	const section1 = new SectionBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent("1. Authenticate with AniList"))
		.setButtonAccessory(new ButtonBuilder().setLabel("Go to AniList").setStyle(ButtonStyle.Link).setURL(url));

	const section2 = new SectionBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent("2. Enter the code you received"))
		.setButtonAccessory(
			new ButtonBuilder().setLabel("Enter Code").setStyle(ButtonStyle.Primary).setCustomId("aniListConnect"),
		);

	container.addSectionComponents(section1, section2);

	const response = await interaction.followUp({
		components: [container],
		fetchReply: true,
		flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
	});

	const buttonCollector = response.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: AUTHENTICATION_TIMEOUT,
	});

	buttonCollector.on("collect", async buttonInteraction => {
		const modal = new ModalBuilder()
			.setTitle("Enter AniList Code")
			.setCustomId(`aniListModal-${buttonInteraction.id}`);

		const tokenInput = new TextInputBuilder()
			.setCustomId("aniListCodeInput")
			.setLabel(`Enter the code`)
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(true);

		modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(tokenInput));

		if (buttonInteraction.customId === "aniListConnect") {
			await buttonInteraction.showModal(modal);
		}

		const modalInteraction = await buttonInteraction
			.awaitModalSubmit({
				time: AUTHENTICATION_TIMEOUT,
				filter: i => i.customId === `aniListModal-${buttonInteraction.id}` && i.user.id === interaction.user.id,
			})
			.catch(() => null);

		if (!modalInteraction) {
			await interaction.editReply(errorContainerMessage("Authentication timed out"));
			return;
		}

		const code = modalInteraction.fields.getTextInputValue("aniListCodeInput");
		const accessToken = await getAccessToken(code);

		await modalInteraction.deferUpdate();

		if (!accessToken) {
			await modalInteraction.followUp(errorContainerMessage("Failed to retrieve access token"));
			return;
		}

		await setAniListAccessToken(interaction.user.id, accessToken);

		hasConnected = true;

		await interaction.editReply({
			components: [simpleContainer("Successfully connected your AniList account", Colors.Blurple)],
		});
	});

	buttonCollector.on("end", async () => {
		if (!hasConnected) {
			await interaction.editReply(errorContainerMessage("Authentication timed out"));
		}
	});
}

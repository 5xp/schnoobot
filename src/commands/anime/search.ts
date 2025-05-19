import ExtendedClient from "@common/ExtendedClient";
import { errorEmbed, errorMessage, simpleEmbed, truncateString } from "@common/reply-utils";
import { getAniListAccessToken } from "@db/services";
import {
	ActionRowBuilder,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ComponentType,
	MessageComponentInteraction,
	MessageFlags,
	SectionBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
} from "discord.js";
import { Anime, MediaListEntry, mediaListStatusEnum } from "./anime.schema";
import {
	deleteListEntry,
	extractUserIdFromAccessToken,
	formatDate,
	formatEmojiMap,
	getAnime,
	getAnimeContainer,
	getListEntry,
	getTitle,
	mediaListStatusMap,
	searchAnime,
	updateListEntry,
} from "./anime.services";
import connect from "./connect";

export async function autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
	const query = interaction.options.getFocused();

	if (!query) {
		await interaction.respond([]);
		return;
	}

	const accessToken = await getAniListAccessToken(interaction.user.id);

	const results = await searchAnime(query, accessToken);

	const options = results.map(result => {
		const formatEmoji = result.format ? formatEmojiMap[result.format] : "";
		const title = getTitle(result.title);
		const adultMarker = result.isAdult ? " 🔞" : "";
		const score = result.meanScore ? ` ⭐${result.meanScore}/100` : "";

		const baseName = `${formatEmoji} ${adultMarker}${score}`.trim();
		const remainingLength = 100 - baseName.length - 1;
		const truncatedTitle = truncateString(title, remainingLength);

		const name = `${formatEmoji} ${truncatedTitle}${adultMarker}${score}`;

		return {
			name: name.slice(0, 100),
			value: `id:${result.id}`,
		};
	});

	await interaction.respond(options);
}

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
	const name = interaction.options.getString("name", true);
	const accessToken = await getAniListAccessToken(interaction.user.id);

	const id = name.startsWith("id:") ? parseInt(name.slice(3)) : undefined;
	const query = id ? undefined : name;

	const anime = await getAnime(id, query, accessToken);

	if (!anime) {
		await interaction.reply(errorMessage("Anime not found"));
		return;
	}

	const aniListUserId = accessToken ? extractUserIdFromAccessToken(accessToken) : undefined;

	const listEntry = aniListUserId ? await getListEntry(aniListUserId, anime.id) : undefined;

	const container = getAnimeContainer(anime, listEntry);

	const listButton = new ButtonBuilder()
		.setCustomId("list")
		.setLabel(listEntry ? "Edit entry" : "Add to list")
		.setEmoji("📝")
		.setStyle(ButtonStyle.Secondary);

	let statusString = "This anime is not in your list.";
	if (listEntry) {
		const joinWithSeparator = (parts: (string | null)[], separator = " • ") =>
			parts.filter(Boolean).join(separator);
		const completedAt = formatDate(listEntry.completedAt);
		const { repeat, progress } = listEntry;
		statusString = joinWithSeparator(
			[
				["CURRENT", "COMPLETED"].includes(listEntry.status)
					? null
					: "Status: " + mediaListStatusMap[listEntry.status],
				completedAt ? `Completed ${completedAt}` : null,
				!completedAt && progress ? `Watched ${progress}/${anime.episodes} episodes` : null,
				repeat ? `${repeat} rewatch${repeat > 1 ? "es" : ""}` : null,
				listEntry.score ? `You rated ${listEntry.score}/100` : null,
			],
			" • ",
		);
	}

	container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));

	const statusTextDisplay = new TextDisplayBuilder().setContent(statusString);
	container.addSectionComponents(
		new SectionBuilder().addTextDisplayComponents(statusTextDisplay).setButtonAccessory(listButton),
	);

	const response = await interaction.reply({
		components: [container],
		flags: MessageFlags.IsComponentsV2,
	});

	const componentInteractionCollector = response.createMessageComponentCollector({
		componentType: ComponentType.Button,
		idle: 180_000,
		filter: i => i.customId === "list",
	});

	componentInteractionCollector.on("collect", interaction => handleComponentInteraction(interaction, anime));

	componentInteractionCollector.on("end", () => {
		listButton.setDisabled(true);
		response.edit({ components: [container] }).catch(() => null);
	});
}

async function handleComponentInteraction(componentInteraction: MessageComponentInteraction, anime: Anime) {
	const { user, customId } = componentInteraction;

	const accessToken = await getAniListAccessToken(user.id);

	if (!accessToken) {
		await connect(componentInteraction, componentInteraction.client as ExtendedClient, true);
		return;
	}

	const aniListUserId = extractUserIdFromAccessToken(accessToken);

	const listEntry = await getListEntry(aniListUserId, anime.id);

	const expandedComponents = getExpandedComponents(listEntry);

	const response = await componentInteraction.reply({
		components: expandedComponents,
		ephemeral: true,
		fetchReply: true,
	});

	const expandedComponentInteraction = await response
		.awaitMessageComponent({
			time: 180_000,
		})
		.catch(() => null);

	if (!expandedComponentInteraction) {
		await response.delete().catch(() => null);
		return;
	}

	await expandedComponentInteraction.deferUpdate();

	const { customId: status } = expandedComponentInteraction;

	if (status === "removeFromList") {
		const success = await deleteListEntry(listEntry!.id, accessToken);
		const embed = success
			? simpleEmbed(`Removed **${getTitle(anime.title)}** from your list`, "Green")
			: errorEmbed("Failed to remove from list");

		await expandedComponentInteraction.editReply({
			embeds: [embed],
			components: [],
		});
		return;
	}

	const newStatus = mediaListStatusEnum.parse(status);

	const success = await updateListEntry(anime.id, newStatus, accessToken);

	const embed = success
		? simpleEmbed(`Updated **${getTitle(anime.title)}** to \`${mediaListStatusMap[newStatus]}\``, "Green")
		: errorEmbed("Failed to update list status");

	await expandedComponentInteraction.editReply({
		embeds: [embed],
		components: [],
	});
}

function getExpandedComponents(listEntry?: MediaListEntry): ActionRowBuilder<ButtonBuilder>[] {
	const buttonRows = [new ActionRowBuilder<ButtonBuilder>(), new ActionRowBuilder<ButtonBuilder>()];

	const setPlanningButton = new ButtonBuilder()
		.setCustomId("PLANNING")
		.setLabel("Plan to watch")
		.setEmoji("📝")
		.setStyle(ButtonStyle.Primary);
	const setCompletedButton = new ButtonBuilder()
		.setCustomId("COMPLETED")
		.setLabel("Set completed")
		.setEmoji("✅")
		.setStyle(ButtonStyle.Secondary);
	const setWatchingButton = new ButtonBuilder()
		.setCustomId("CURRENT")
		.setLabel("Set watching")
		.setEmoji("👀")
		.setStyle(ButtonStyle.Secondary);
	const setDroppedButton = new ButtonBuilder()
		.setCustomId("DROPPED")
		.setLabel("Set dropped")
		.setEmoji("❌")
		.setStyle(ButtonStyle.Secondary);
	const setPausedButton = new ButtonBuilder()
		.setCustomId("PAUSED")
		.setLabel("Set paused")
		.setEmoji("⏸️")
		.setStyle(ButtonStyle.Secondary);
	const setRepeatingButton = new ButtonBuilder()
		.setCustomId("REPEATING")
		.setLabel("Set repeating")
		.setEmoji("🔁")
		.setStyle(ButtonStyle.Secondary);
	const removeFromListButton = new ButtonBuilder()
		.setCustomId("removeFromList")
		.setLabel("Remove from list")
		.setEmoji("🗑️")
		.setStyle(ButtonStyle.Danger);

	buttonRows[0].addComponents(
		setPlanningButton,
		setCompletedButton,
		setWatchingButton,
		setRepeatingButton,
		setPausedButton,
	);
	buttonRows[1].addComponents(setDroppedButton);
	if (listEntry) {
		buttonRows[1].addComponents(removeFromListButton);
	}

	return buttonRows;
}

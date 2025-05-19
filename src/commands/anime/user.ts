import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { getAniListAccessToken } from "@db/services";
import {
	AutocompleteInteraction,
	ButtonBuilder,
	ChatInputCommandInteraction,
	ComponentType,
	MessageFlags,
	SectionBuilder,
} from "discord.js";
import { AnimeUser } from "./anime.schema";
import {
	extractUserIdFromAccessToken,
	getAnimeUser,
	getAnimeUserContainer,
	getUserLastActivity,
	searchUsers,
} from "./anime.services";
import connect from "./connect";
import { executeFromComponent } from "./search";

export async function autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
	const query = interaction.options.getFocused();

	if (!query) {
		await interaction.respond([]);
		return;
	}

	const results = await searchUsers(query);

	const options = results.map(result => ({
		name: result.name.slice(0, 100),
		value: result.name.slice(0, 100),
	}));

	await interaction.respond(options);
}

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
	const username = interaction.options.getString("username", false);
	const discordUser = !username
		? (interaction.options.getUser("discord-user", false) ?? interaction.user)
		: undefined;
	const isSelf = discordUser && discordUser.id === interaction.user.id;
	const selfAccessToken = await getAniListAccessToken(interaction.user.id);

	let animeUser: AnimeUser | null = null;

	if (username) {
		animeUser = await getAnimeUser({ query: username, accessToken: selfAccessToken });
	} else if (discordUser) {
		const accessToken = isSelf ? selfAccessToken : await getAniListAccessToken(discordUser.id);

		if (!accessToken && isSelf) {
			await connect(interaction, client);
			return;
		} else if (!accessToken) {
			await interaction.reply(errorMessage("User has not connected their AniList account"));
			return;
		}

		const aniListUserId = extractUserIdFromAccessToken(accessToken);
		animeUser = await getAnimeUser({ id: aniListUserId, accessToken: selfAccessToken });
	}

	if (!animeUser) {
		await interaction.reply(errorMessage("User not found"));
		return;
	}

	const lastActivity = await getUserLastActivity(animeUser.id);
	const container = getAnimeUserContainer(animeUser, lastActivity, discordUser);

	const response = await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });

	if (!lastActivity) {
		return;
	}

	const collector = response.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 300_000,
	});

	collector.on("collect", async componentInteraction => {
		await executeFromComponent(componentInteraction, lastActivity.media.id);
	});

	collector.on("end", async () => {
		container.components.forEach(component => {
			if (!(component instanceof SectionBuilder)) return;
			if (!(component.accessory instanceof ButtonBuilder)) return;
			component.accessory.setDisabled(true);
		});
		await interaction.editReply({ components: [container] });
	});
}

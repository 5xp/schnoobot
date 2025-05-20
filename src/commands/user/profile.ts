import ExtendedClient from "@common/ExtendedClient";
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ContainerBuilder,
	GuildMember,
	InteractionContextType,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageComponentInteraction,
	MessageFlags,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	TextDisplayBuilder,
	User,
	UserContextMenuCommandInteraction,
} from "discord.js";

const SIZE = { size: 4096 };
const INTERACTION_TIMEOUT = 60_000;

export default {
	data: new SlashCommandBuilder()
		.setName("profile")
		.setDescription("View your or another user's profile (avatar and banner)")
		.addUserOption(option =>
			option.setName("user").setDescription("The user to get the profile of").setRequired(false),
		)
		.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
		.setContexts([
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		]),
	async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
		const user = interaction.options.getUser("user") ?? interaction.user;
		const guildMember = interaction.inCachedGuild() ? interaction.guild.members.resolve(user) : null;
		run(interaction, client, guildMember ?? user, false);
	},
};

export async function run(
	interaction: ValidInteraction,
	client: ExtendedClient,
	user: User | GuildMember,
	showGuildAppearance: boolean,
): Promise<void> {
	// We need to force fetch the user to have their banner
	await user.fetch(true);

	const hasGuildAvatar = isGuildMember(user) && !!user.avatar;
	const avatarIsIdentical = isGuildMember(user) && user.avatar === user.user.avatar;
	const mainAvatarURL = isGuildMember(user) ? user.user.displayAvatarURL(SIZE) : user.displayAvatarURL(SIZE);
	const guildAvatarURL = isGuildMember(user) ? user.displayAvatarURL(SIZE) : null;

	const hasGuildBanner = isGuildMember(user) && !!user.banner;
	const bannerIsIdentical = isGuildMember(user) && user.banner === user.user.banner;
	const mainBannerURL = isGuildMember(user) ? user.user.bannerURL(SIZE) : user.bannerURL(SIZE);
	const guildBannerURL = isGuildMember(user) ? user.bannerURL(SIZE) : null;

	const showSwitchButton = (hasGuildAvatar && !avatarIsIdentical) || (hasGuildBanner && !bannerIsIdentical);

	showGuildAppearance &&= showSwitchButton;

	const relevantAvatarURL = showGuildAppearance ? guildAvatarURL : mainAvatarURL;
	const relevantBannerURL = showGuildAppearance ? guildBannerURL : mainBannerURL;

	const container = new ContainerBuilder();

	const switchButton = new ButtonBuilder()
		.setCustomId("switch")
		.setLabel(showGuildAppearance ? "Show main profile" : "Show server profile")
		.setStyle(ButtonStyle.Primary);

	const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(switchButton);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`## ${user}${showGuildAppearance ? "'s Server Profile" : "'s Main Profile"}`,
		),
	);

	container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

	if (relevantBannerURL) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`-# ${showGuildAppearance ? "Server" : "Main"} Banner`),
		);
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(relevantBannerURL)),
		);
	}

	if (relevantBannerURL && relevantAvatarURL) {
		container.addSeparatorComponents(separator =>
			separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
		);
	}

	if (relevantAvatarURL) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`-# ${showGuildAppearance ? "Server" : "Main"} Avatar`),
		);
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(relevantAvatarURL)),
		);
	}

	if (showSwitchButton) {
		container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
		container.addActionRowComponents(actionRow);
	}

	const options = {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { parse: [] },
	} as const;

	const response = interaction.isMessageComponent()
		? await interaction.update(options)
		: await interaction.reply(options);

	const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;

	const componentInteraction = await response
		.awaitMessageComponent({ filter, time: INTERACTION_TIMEOUT })
		.catch(() => null);

	if (!componentInteraction) {
		switchButton.setDisabled(true);
		switchButton.setStyle(ButtonStyle.Secondary);
		interaction.editReply(options).catch(() => null);
		return;
	}

	run(componentInteraction, client, user, !showGuildAppearance);
}

function isGuildMember(user: User | GuildMember): user is GuildMember {
	return "guild" in user;
}

type ValidInteraction = ChatInputCommandInteraction | UserContextMenuCommandInteraction | MessageComponentInteraction;

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageComponentInteraction,
  User,
  GuildMember,
  Colors,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js";
import ExtendedClient from "@common/ExtendedClient";

export default {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Get yourself or another user's avatar")
    .addUserOption(option => option.setName("user").setDescription("The user to get the avatar of").setRequired(false)),
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
  showGuildAvatar: boolean,
): Promise<void> {
  const hasGuildAvatar = isGuildMember(user) && !!user.avatar;
  const avatarIsIdentical = isGuildMember(user) && user.avatar === user.user.avatar;
  const showSwitchButton = hasGuildAvatar && !avatarIsIdentical;

  showGuildAvatar &&= showSwitchButton;

  const globalAvatarURL = isGuildMember(user)
    ? user.user.displayAvatarURL({ size: 4096 })
    : user.displayAvatarURL({ size: 4096 });

  const guildAvatarURL = isGuildMember(user) ? user.displayAvatarURL({ size: 4096 }) : null;

  const name = isGuildMember(user) ? user.displayName : user.username;

  const embed = new EmbedBuilder()
    .setTitle(name + (showGuildAvatar ? "'s guild avatar" : "'s avatar"))
    .setImage(showGuildAvatar ? guildAvatarURL : globalAvatarURL)
    .setColor(Colors.Blurple);

  const switchButton = new ButtonBuilder()
    .setCustomId("switch")
    .setLabel(!showGuildAvatar ? "Show guild avatar" : "Show global avatar")
    .setStyle(ButtonStyle.Primary);

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(switchButton);

  const options = {
    embeds: [embed],
    components: showSwitchButton ? [actionRow] : undefined,
  };

  const response = interaction.isMessageComponent()
    ? await interaction.update(options)
    : await interaction.reply(options);

  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;

  const componentInteraction = await response.awaitMessageComponent({ filter, time: 60_000 }).catch(() => null);

  if (!componentInteraction) {
    actionRow.components[0].setDisabled(true);
    interaction.editReply({ components: showGuildAvatar ? [actionRow] : undefined });
    return;
  }

  run(componentInteraction, client, user, !showGuildAvatar);
}

function isGuildMember(user: User | GuildMember): user is GuildMember {
  return "displayName" in user;
}

type ValidInteraction = ChatInputCommandInteraction | UserContextMenuCommandInteraction | MessageComponentInteraction;

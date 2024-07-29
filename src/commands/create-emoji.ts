import { errorMessage } from "@common/reply-utils";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  MessageComponentInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
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
        .addStringOption(option => option.setName("url").setDescription("The URL of the emoji").setRequired(true))
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
    .setDMPermission(false),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply(errorMessage("This command can only be used in a server."));
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageGuildExpressions)) {
      await interaction.reply(errorMessage(`I don't have ${inlineCode("Manage Emojis and Stickers")} permissions!`));
      return;
    }

    const name = interaction.options.getString("name", true);

    if (name.includes(" ")) {
      await interaction.reply(errorMessage("The name of the emoji cannot contain spaces."));
      return;
    }

    const subcommand = subcommandTypes.parse(interaction.options.getSubcommand());

    let url: string;

    switch (subcommand) {
      case "attachment": {
        const attachment = interaction.options.getAttachment("image", true);

        if (!allowedExtensions.some(extension => attachment.name.endsWith(extension))) {
          await interaction.reply(errorMessage("The attachment must be an image."));
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
          errorMessage(`There was an error trying to create the emoji: ${inlineCode(errorString)}`),
        );
      });

    if (!emoji) {
      return;
    }

    const extension = emoji.animated ? "gif" : "webp";

    const embed = new EmbedBuilder()
      .setTitle("Created a new emoji")
      .setImage(emoji.imageURL({ size: 4096, extension }))
      .setFooter({ text: name })
      .setColor(Colors.Blurple);

    const deleteButton = new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Secondary);
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton);

    const response = await interaction.editReply({ embeds: [embed], components: [actionRow] });
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

      interaction.followUp(errorMessage(`There was an error trying to delete the emoji: ${inlineCode(errorString)}`));
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

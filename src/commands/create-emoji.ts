import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  inlineCode,
  ChatInputCommandInteraction,
  Colors,
  bold,
} from "discord.js";
import { errorMessage } from "@common/reply-utils";
import { z } from "zod";

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
      interaction.reply(errorMessage("This command can only be used in a server."));
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageGuildExpressions)) {
      interaction.reply(errorMessage(`I don't have ${inlineCode("Manage Emojis and Stickers")} permissions!`));
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
        url = attachment.url;

        if (!url.endsWith(".png") && !url.endsWith(".jpg") && !url.endsWith(".jpeg") && !url.endsWith(".gif")) {
          await interaction.reply(errorMessage("The attachment must be an image."));

          return;
        }

        break;
      }

      case "url":
        url = interaction.options.getString("url", true);
    }

    await interaction.deferReply();

    try {
      const emoji = await interaction.guild.emojis.create({ attachment: url, name });

      const embed = new EmbedBuilder()
        .setTitle("Created a new emoji")
        .setImage(emoji.url)
        .setFooter({ text: name })
        .setColor(Colors.Blurple);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);

      const errorResult = errorSchema.safeParse(error);
      const errorString = errorResult.success ? errorResult.data.rawError.message : "Unknown error";

      await interaction.editReply(
        errorMessage(`There was an error trying to create the emoji: ${inlineCode(errorString)}`),
      );
    }
  },
};

const errorSchema = z.object({
  rawError: z.object({
    message: z.string(),
  }),
});

const subcommandTypes = z.union([z.literal("url"), z.literal("attachment")]);

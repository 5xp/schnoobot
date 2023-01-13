const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, inlineCode } = require("discord.js");

module.exports = {
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers),
  async execute(interaction) {
    const name = interaction.options.getString("name");

    if (name.includes(" ")) {
      await interaction.reply({
        content: "The name of the emoji cannot contain spaces.",
        ephemeral: true,
      });

      return;
    }

    const subcommand = interaction.options.getSubcommand();

    let url;

    if (subcommand === "url") {
      url = interaction.options.getString("url");
    } else if (subcommand === "attachment") {
      const attachment = interaction.options.getAttachment("image");
      url = attachment.url;

      if (!url.endsWith(".png") && !url.endsWith(".jpg") && !url.endsWith(".jpeg") && !url.endsWith(".gif")) {
        await interaction.reply({
          content: "The attachment must be an image.",
          ephemeral: true,
        });

        return;
      }
    }

    try {
      const emoji = await interaction.guild.emojis.create({ attachment: url, name });

      const embed = new EmbedBuilder()
        .setTitle("Created a new emoji")
        .setImage(emoji.url)
        .setFooter({ text: emoji.name })
        .setColor("Blurple");

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: `There was an error trying to create the emoji: ${inlineCode(error.rawError.message)}`,
        ephemeral: true,
      });
    }
  },
};

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  codeBlock,
  AttachmentBuilder,
} = require("discord.js");

function clean(text) {
  if (typeof text === "string") {
    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
  } else {
    return text;
  }
}

module.exports = {
  data: new SlashCommandBuilder().setName("run-code").setDescription("Run code"),
  devOnly: true,
  async execute(interaction) {
    if (interaction.user.id !== interaction.client.application.owner.id) {
      await interaction.reply({
        content: "Only the bot owner can use this command.",
        ephemeral: true,
      });

      return;
    }

    const modal = new ModalBuilder().setCustomId("run-code").setTitle("Run code");

    const codeInput = new TextInputBuilder()
      .setCustomId("code")
      .setLabel("Run code")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(codeInput);

    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    const filter = i => i.customId === "run-code";

    const submission = await interaction.awaitModalSubmit({ filter, time: 60_000 });

    const code = submission.fields.getTextInputValue("code");
    const codeFormatted = codeBlock("js", code);

    let evaled = await eval(code);

    if (typeof evaled !== "string") {
      evaled = require("util").inspect(evaled);
    }

    evaled = clean(evaled);

    const evalFormatted = codeBlock("xl", evaled);

    if (evalFormatted.length <= 4096 && codeFormatted.length + evalFormatted.length <= 6000) {
      const embed = new EmbedBuilder().setDescription(evalFormatted);

      await submission.reply({ content: codeBlock("js", code), embeds: [embed], ephemeral: true });
    } else {
      const buffer = Buffer.from(evaled, "utf-8");
      const attachment = new AttachmentBuilder(buffer, { name: "response.xl" });

      await submission.reply({
        content: codeBlock("js", code),
        files: [attachment],
        ephemeral: true,
      });
    }
  },
};

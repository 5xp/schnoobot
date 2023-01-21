const { ContextMenuCommandBuilder, ApplicationCommandType } = require("discord.js");
const { execute } = require("./dl.menu");

module.exports = {
  data: new ContextMenuCommandBuilder().setName("Download Videos (Ephemeral)").setType(ApplicationCommandType.Message),
  async execute(interaction) {
    await execute(interaction, true);
  },
};

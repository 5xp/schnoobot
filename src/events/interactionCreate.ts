import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { BaseInteraction, Events } from "discord.js";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: BaseInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

    const client = interaction.client as ExtendedClient;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`Command ${interaction.commandName} not found.`);
      interaction.reply(errorMessage("Command not found."));
      return;
    }

    try {
      command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const func = interaction.deferred || interaction.replied ? interaction.followUp : interaction.reply;
      func.call(interaction, errorMessage("There was an error while executing this command!"));
    }
  },
};

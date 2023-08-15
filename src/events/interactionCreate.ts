import { BaseInteraction, Events } from "discord.js";
import ExtendedClient from "@common/ExtendedClient";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: BaseInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

    const client = interaction.client as ExtendedClient;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`Command ${interaction.commandName} not found.`);
      return;
    }

    try {
      command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const func = interaction.deferred || interaction.replied ? interaction.followUp : interaction.reply;
      func.call(interaction, { content: "There was an error while executing this command!", ephemeral: true });
    }
  },
};

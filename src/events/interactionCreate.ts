import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { BaseInteraction, Events } from "discord.js";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: BaseInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand() && !interaction.isAutocomplete())
      return;

    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`Command ${interaction.commandName} not found.`);

      if (!interaction.isAutocomplete()) {
        interaction.reply(errorMessage("Command not found."));
      }

      return;
    }

    try {
      if (interaction.isAutocomplete()) {
        if (!command.autocomplete) {
          console.error(`Command ${interaction.commandName} does not have an autocomplete function.`);
          console.log(command);
          return;
        }

        command.autocomplete(interaction, client);
      } else {
        command.execute(interaction, client);
      }
    } catch (error) {
      console.error(error);

      if (interaction.isAutocomplete()) {
        return;
      }

      const func = interaction.deferred || interaction.replied ? interaction.followUp : interaction.reply;
      func.call(interaction, errorMessage("There was an error while executing this command!"));
    }
  },
};

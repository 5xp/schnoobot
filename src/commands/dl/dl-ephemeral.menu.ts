import ExtendedClient from "@common/ExtendedClient";
import { ApplicationCommandType, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";
import dl from "./dl.menu";

export default {
  data: new ContextMenuCommandBuilder().setName("Download Media (Ephemeral)").setType(ApplicationCommandType.Message),
  isUserCommand: true,
  async execute(interaction: MessageContextMenuCommandInteraction, client: ExtendedClient) {
    dl.execute(interaction, client, true);
  },
};

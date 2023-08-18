import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import dl from "./dl.menu";
import ExtendedClient from "@common/ExtendedClient";

export default {
  data: new ContextMenuCommandBuilder().setName("Download Videos (Ephemeral)").setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction, client: ExtendedClient) {
    dl.execute(interaction, client, true);
  },
};

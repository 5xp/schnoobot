import ExtendedClient from "@common/ExtendedClient";
import { ApplicationCommandType, ContextMenuCommandBuilder, UserContextMenuCommandInteraction } from "discord.js";
import { run } from "./avatar";

export default {
  data: new ContextMenuCommandBuilder().setName("View user's avatar").setType(ApplicationCommandType.User),
  async execute(interaction: UserContextMenuCommandInteraction, client: ExtendedClient): Promise<void> {
    const user = interaction.targetUser;
    const guildMember = interaction.inCachedGuild() ? interaction.guild.members.resolve(user) : null;
    run(interaction, client, guildMember ?? user, false);
  },
};

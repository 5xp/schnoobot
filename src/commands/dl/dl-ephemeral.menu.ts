import ExtendedClient from "@common/ExtendedClient";
import {
	ApplicationCommandType,
	ApplicationIntegrationType,
	ContextMenuCommandBuilder,
	InteractionContextType,
	MessageContextMenuCommandInteraction,
} from "discord.js";
import dl from "./dl.menu";

export default {
	data: new ContextMenuCommandBuilder()
		.setName("Download Media (Ephemeral)")
		.setType(ApplicationCommandType.Message)
		.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
		.setContexts([
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		]),
	async execute(interaction: MessageContextMenuCommandInteraction, client: ExtendedClient) {
		dl.execute(interaction, client, true);
	},
};

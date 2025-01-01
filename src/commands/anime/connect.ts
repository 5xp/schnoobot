import ExtendedClient from "@common/ExtendedClient";
import { errorEmbed, errorMessage, simpleEmbed } from "@common/reply-utils";
import { setAniListAccessToken } from "@db/services";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { ENV } from "env";
import { getAccessToken } from "./anime.services";

export default async function execute(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  cameFromOtherAction = false,
) {
  const { ANILIST_CLIENT_ID: clientId, ANILIST_REDIRECT_URI: redirectUri } = ENV;

  if (!clientId || !redirectUri) {
    await interaction.reply(errorMessage("AniList credentials are not configured"));
    return;
  }

  let hasConnected = false;

  let message = cameFromOtherAction ? "This action requires you to connect your AniList account.\n" : "";
  message +=
    'Use the link button below to connect your AniList account, then use the "Enter Code" button to enter the code you receive.';
  const embed = simpleEmbed(message, "Orange");

  const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("1. Authorize on AniList").setURL(url),
  );
  const authorizeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("2. Enter Code").setCustomId("aniListConnect"),
  );

  const response = await interaction.reply({ embeds: [embed], components: [linkRow, authorizeRow], ephemeral: true });

  const buttonCollector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300_000,
  });

  buttonCollector.on("collect", async buttonInteraction => {
    const modal = new ModalBuilder().setTitle("Enter AniList Code").setCustomId(`aniListModal-${buttonInteraction.id}`);

    const tokenInput = new TextInputBuilder()
      .setCustomId("aniListCodeInput")
      .setLabel(`Enter the code`)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(tokenInput));

    if (buttonInteraction.customId === "aniListConnect") {
      await buttonInteraction.showModal(modal);
    }

    const modalInteraction = await buttonInteraction
      .awaitModalSubmit({
        time: 300_000,
        filter: i => i.customId === `aniListModal-${buttonInteraction.id}` && i.user.id === interaction.user.id,
      })
      .catch(() => null);

    if (!modalInteraction) {
      await interaction.editReply({ content: "Connection timed out", components: [] });
      return;
    }

    const code = modalInteraction.fields.getTextInputValue("aniListCodeInput");
    const accessToken = await getAccessToken(code);

    await modalInteraction.deferUpdate();

    if (!accessToken) {
      await modalInteraction.followUp(errorMessage("Failed to retrieve access token"));
      return;
    }

    await setAniListAccessToken(interaction.user.id, accessToken);

    hasConnected = true;

    await interaction.editReply({
      embeds: [simpleEmbed("Successfully connected your AniList account")],
      components: [],
      content: null,
    });
  });

  buttonCollector.on("end", async () => {
    if (!hasConnected) {
      await interaction.editReply({ embeds: [errorEmbed("Connection timed out")], components: [] });
    }
  });
}

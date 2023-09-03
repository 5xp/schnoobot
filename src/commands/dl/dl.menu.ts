import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  bold,
  MessageContextMenuCommandInteraction,
  MessageComponentInteraction,
} from "discord.js";
import { run } from "./dl";
import ExtendedClient from "@common/ExtendedClient";
import { errorMessage, simpleEmbed } from "@common/reply-utils";

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

async function selectUrl(interaction: MessageContextMenuCommandInteraction, urls: string[]) {
  const urlSelect = new StringSelectMenuBuilder()
    .setCustomId("urlSelect")
    .setPlaceholder("Select a URL")
    .addOptions(
      urls.map(url => {
        return {
          label: url,
          value: url,
        };
      }),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(urlSelect);

  const reply = await interaction.reply({
    embeds: [simpleEmbed("Select a URL to download.")],
    components: [row],
    ephemeral: true,
  });

  const filter = (i: MessageComponentInteraction) => i.customId === "urlSelect" && i.user.id === interaction.user.id;

  const i = await reply.awaitMessageComponent({ filter, time: 10_000 }).catch(() => null);

  if (!i || !i.isStringSelectMenu()) {
    interaction.deleteReply();
    return;
  }

  const selectedUrl = i.values[0];

  i.update({ content: bold(`🚀 [Downloading...](<${selectedUrl}>)`), components: [], embeds: [] });
  return selectedUrl;
}

export default {
  data: new ContextMenuCommandBuilder().setName("Download Videos").setType(ApplicationCommandType.Message),
  async execute(
    interaction: MessageContextMenuCommandInteraction,
    client: ExtendedClient,
    ephemeral = false,
  ): Promise<void> {
    const message = interaction.targetMessage;

    let urls = message.content.match(urlRegex);

    if (!urls) {
      interaction.reply(errorMessage("No URLs found in message!"));
      return;
    }

    const urlSet = [...new Set(urls)];

    let url;

    if (urlSet.length > 1) {
      url = await selectUrl(interaction, urlSet);
    } else {
      url = urls[0];
    }

    if (!url) return;

    run({ interaction, url, ephemeral });
  },
};

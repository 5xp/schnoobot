import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import {
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  InteractionResponse,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { supportedWikis } from "./Wiki";
import Paginator from "./Paginator";

export async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const query = interaction.options.getString("query", true);

  // If the query is not a number, we know the user did not autocomplete
  if (Number.isNaN(Number(query))) {
    interaction.reply(errorMessage("Invalid query. Please select a suggestion from autocomplete."));
    return;
  }

  const wikiKey = interaction.options.getString("name", true);

  const wiki = supportedWikis.get(wikiKey);

  if (!wiki) {
    console.error(`Wiki ${wikiKey} not found.`);
    return;
  }

  const pageUrl = await wiki.scraper.getPageUrl(wiki.url, query).catch(error => {
    console.error(error);
    return null;
  });

  if (!pageUrl) {
    interaction.reply(errorMessage("Page not found."));
    return;
  }

  const { title, contentElement, image } = await wiki.scraper
    .getContent(wiki.url, pageUrl, wiki.transformContentElement, wiki.getImage)
    .catch(error => {
      console.error(error);
      return { title: null, contentElement: null, image: null };
    });

  if (!contentElement || !title) {
    interaction.reply(errorMessage("An error occurred while fetching the page."));
    return;
  }

  wiki.scraper.stripUnwantedElements(contentElement);
  const sections = wiki.scraper.splitIntoSections(contentElement);
  const markdownSections = sections.map(section => wiki.scraper.getMarkdown(section));

  const wikiPage = new Paginator(pageUrl, title, markdownSections, image ?? undefined);

  if (wiki.color) {
    wikiPage.color = wiki.color;
  }

  const messageData = getMessageData(wikiPage);

  if (interaction.options.getBoolean("hide")) {
    messageData.ephemeral = true;
  }

  const response = await interaction.reply(messageData);

  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
  createComponentCollector(wikiPage, response, filter);
}

function createComponentCollector(
  wikiPage: Paginator,
  response: InteractionResponse,
  filter?: (i: MessageComponentInteraction) => boolean,
): void {
  if (wikiPage.pages.length <= 1) {
    return;
  }

  const collector = response.createMessageComponentCollector({ idle: 180_000, filter });

  collector.on("collect", async i => {
    if (i.customId === "previous") {
      wikiPage.currentPage--;
    } else if (i.customId === "next") {
      wikiPage.currentPage++;
    }

    wikiPage.currentPage = Math.max(Math.min(wikiPage.currentPage, wikiPage.pages.length - 1), 0);

    await i.update(getMessageData(wikiPage));
  });
}

function getEmbed(wikiPage: Paginator): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(wikiPage.title)
    .setURL(wikiPage.url)
    .setDescription(wikiPage.pages[wikiPage.currentPage])
    .setThumbnail(wikiPage.image ?? null)
    .setFooter({
      text: `Page ${wikiPage.currentPage + 1}/${
        wikiPage.pages.length
      } ⚠️ Tables and other formatted content may not be visible.`,
    })
    .setColor(wikiPage.color);
}

function getActionRow(wikiPage: Paginator): ActionRowBuilder<ButtonBuilder> | undefined {
  if (wikiPage.pages.length <= 1) {
    return;
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>();

  const previousButton = new ButtonBuilder().setCustomId("previous").setEmoji("⬅️").setStyle(ButtonStyle.Secondary);
  const nextButton = new ButtonBuilder().setCustomId("next").setEmoji("➡️").setStyle(ButtonStyle.Secondary);

  if (wikiPage.currentPage <= 0) {
    previousButton.setDisabled(true);
  }

  if (wikiPage.currentPage >= wikiPage.pages.length - 1) {
    nextButton.setDisabled(true);
  }

  return actionRow.addComponents(previousButton, nextButton);
}

function getMessageData(paginator: Paginator, ephemeral?: boolean) {
  const actionRow = getActionRow(paginator);
  return {
    embeds: [getEmbed(paginator)],
    ...(actionRow && { components: [actionRow] }),
    ...(ephemeral && { ephemeral }),
  };
}

import ExtendedClient from "@common/ExtendedClient";
import { errorMessage, truncateString } from "@common/reply-utils";
import { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { formatEmojiMap, getAnime, getAnimeEmbed, getTitle, searchAnime } from "./anime.services";

export async function autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
  const query = interaction.options.getFocused();

  if (!query) {
    await interaction.respond([]);
    return;
  }

  const results = await searchAnime(query);

  const options = results.map(result => {
    const formatEmoji = result.format ? formatEmojiMap[result.format] : "";
    const title = getTitle(result.title);
    const adultMarker = result.isAdult ? " 🔞" : "";
    const score = result.meanScore ? ` ⭐${result.meanScore}/100` : "";

    const baseName = `${formatEmoji} ${adultMarker}${score}`.trim();
    const remainingLength = 100 - baseName.length - 1;
    const truncatedTitle = truncateString(title, remainingLength);

    const name = `${formatEmoji} ${truncatedTitle}${adultMarker}${score}`;

    return {
      name: name.slice(0, 100),
      value: `id:${result.id}`,
    };
  });

  await interaction.respond(options);
}

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  const name = interaction.options.getString("name", true);

  const id = name.startsWith("id:") ? parseInt(name.slice(3)) : undefined;
  const query = id ? undefined : name;

  const anime = await getAnime(id, query);

  if (!anime) {
    await interaction.reply(errorMessage("Anime not found"));
    return;
  }

  const embed = getAnimeEmbed(anime);

  await interaction.reply({ embeds: [embed] });
}

import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { getAnimeUser, getAnimeUserEmbed, getUserLastActivity, searchUsers } from "../anime.services";

export async function autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
  const query = interaction.options.getFocused();

  if (!query) {
    await interaction.respond([]);
    return;
  }

  const results = await searchUsers(query);

  const options = results.map(result => ({
    name: result.name.slice(0, 100),
    value: result.name.slice(0, 100),
  }));

  await interaction.respond(options);
}

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const username = interaction.options.getString("username", true);

  const animeUser = await getAnimeUser({ query: username });

  if (!animeUser) {
    await interaction.reply(errorMessage("User not found"));
    return;
  }

  const lastActivity = await getUserLastActivity(animeUser.id);
  const embed = getAnimeUserEmbed(animeUser, lastActivity);

  await interaction.reply({ embeds: [embed] });
}

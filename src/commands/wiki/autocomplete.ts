import ExtendedClient from "@common/ExtendedClient";
import { AutocompleteInteraction } from "discord.js";
import { supportedWikis } from "./Wiki";

export async function autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
  const wikiKey = interaction.options.getString("name");

  if (!wikiKey) {
    return;
  }

  const wiki = supportedWikis.get(wikiKey);

  if (!wiki) {
    console.error(`Wiki ${wikiKey} not found.`);
    return;
  }

  const focusedValue = interaction.options.getFocused();

  if (!focusedValue) {
    interaction.respond([]);
    return;
  }

  const choices = await wiki.autocomplete(focusedValue);

  await interaction.respond(choices);
}

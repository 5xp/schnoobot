import { bold, EmbedBuilder } from "discord.js";

export function errorEmbed(error: string): EmbedBuilder {
  return new EmbedBuilder().setDescription(bold(error)).setColor("Red");
}

export function simpleEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setDescription(message).setColor("Blurple");
}

export function errorMessage(error: string) {
  return { embeds: [errorEmbed(error)], ephemeral: true };
}

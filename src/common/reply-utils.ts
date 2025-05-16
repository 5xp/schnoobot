import { bold, ColorResolvable, EmbedBuilder } from "discord.js";

export function errorEmbed(error: string): EmbedBuilder {
	return new EmbedBuilder().setDescription(bold(error)).setColor("Red");
}

export function simpleEmbed(message: string, color: ColorResolvable = "Blurple"): EmbedBuilder {
	return new EmbedBuilder().setDescription(message).setColor(color);
}

export function errorMessage(error: string) {
	return { embeds: [errorEmbed(error)], ephemeral: true };
}

export function truncateString(input: string, maxLength: number): string {
	if (input.length <= maxLength) {
		return input;
	}
	return input.substring(0, maxLength - 1) + "…";
}

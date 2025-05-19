import {
	bold,
	ColorResolvable,
	Colors,
	ContainerBuilder,
	EmbedBuilder,
	MessageFlags,
	RGBTuple,
	TextDisplayBuilder,
} from "discord.js";

export function errorEmbed(error: string): EmbedBuilder {
	return new EmbedBuilder().setDescription(bold(error)).setColor("Red");
}

export function simpleEmbed(message: string, color: ColorResolvable = "Blurple"): EmbedBuilder {
	return new EmbedBuilder().setDescription(message).setColor(color);
}

export function errorMessage(error: string) {
	return { embeds: [errorEmbed(error)], ephemeral: true };
}

export function errorContainer(error: string): ContainerBuilder {
	return new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(bold(error)))
		.setAccentColor(Colors.Red);
}

export function simpleContainer(message: string, color?: RGBTuple | number): ContainerBuilder {
	return new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(message))
		.setAccentColor(color);
}

export function errorContainerMessage(error: string) {
	return {
		components: [errorContainer(error)],
		flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
	};
}

export function truncateString(input: string, maxLength: number): string {
	if (input.length <= maxLength) {
		return input;
	}
	return input.substring(0, maxLength - 1) + "…";
}

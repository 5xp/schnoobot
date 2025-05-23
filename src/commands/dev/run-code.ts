import ExtendedClient from "@common/ExtendedClient";
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	ModalBuilder,
	ModalSubmitInteraction,
	TextInputBuilder,
	TextInputStyle,
	codeBlock,
} from "discord.js";

function clean(text: string): string {
	if (typeof text === "string") {
		return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
	} else {
		return text;
	}
}

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
	const modal = new ModalBuilder().setCustomId("run-code").setTitle("Run code");

	const codeInput = new TextInputBuilder()
		.setCustomId("code")
		.setLabel("Run code")
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(true);

	const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput);

	modal.addComponents(actionRow);

	await interaction.showModal(modal);

	const filter = (i: ModalSubmitInteraction) => i.customId === "run-code";

	const submission = await interaction.awaitModalSubmit({ filter, time: 300_000 }).catch(() => null);

	if (!submission) {
		return;
	}

	const code = submission.fields.getTextInputValue("code");
	const codeFormatted = codeBlock("js", code);

	let evaled: any;
	try {
		evaled = await eval(code);
	} catch (error) {
		evaled = error;
	}

	if (typeof evaled !== "string") {
		evaled = require("util").inspect(evaled);
	}

	evaled = clean(evaled);

	const evalFormatted = codeBlock("xl", evaled);

	if (evalFormatted.length <= 4096 && codeFormatted.length + evalFormatted.length <= 6000) {
		const embed = new EmbedBuilder().setDescription(evalFormatted);

		await submission.reply({ content: codeBlock("js", code), embeds: [embed], ephemeral: true });
	} else {
		const buffer = Buffer.from(evaled, "utf-8");
		const attachment = new AttachmentBuilder(buffer, { name: "response.xl" });

		await submission.reply({
			content: codeBlock("js", code),
			files: [attachment],
			ephemeral: true,
		});
	}
}

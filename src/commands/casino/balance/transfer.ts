import Currency from "@common/Currency";
import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { getBalance, transferBalance } from "@db/services";
import { ChatInputCommandInteraction, EmbedBuilder, bold } from "discord.js";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
	const amountString = interaction.options.getString("amount", true);
	const recipient = interaction.options.getUser("recipient", true);

	if (interaction.user.id === recipient.id) {
		interaction.reply(errorMessage("You can't transfer to yourself!"));
		return;
	}

	const balance = await getBalance(interaction.user.id);
	const amount = new Currency(amountString, balance);

	if (amount.validity.code !== "valid") {
		interaction.reply(errorMessage(amount.validity.message));
		return;
	}

	const {
		user: { balance: userBalance },
		target: { balance: targetBalance },
	} = await transferBalance(interaction.user.id, recipient.id, amount.value);

	const embed = new EmbedBuilder()
		.setTitle(`${interaction.user.username}'s transfer to ${recipient.username}`)
		.setColor("Blurple")
		.addFields(
			{ name: bold("Transfer Amount"), value: amount.formatted, inline: true },
			{ name: bold("New Balance"), value: Currency.format(userBalance), inline: true },
			{ name: bold(`${recipient.username}'s Balance`), value: Currency.format(targetBalance), inline: true },
		);

	interaction.reply({ embeds: [embed] });
}

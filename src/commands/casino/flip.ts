import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChatInputCommandInteraction,
  bold,
  User,
  MessageComponentInteraction,
} from "discord.js";
import Currency from "@common/Currency";
import ExtendedClient from "@common/ExtendedClient";
import { z } from "zod";
import { errorMessage } from "@common/reply-utils";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const wagerInput = interaction.options.getString("wager", true);
  const choice = FlipChoiceSchema.parse(interaction.options.getString("choice", true));

  run(interaction, client, choice, wagerInput);
}

async function run(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  client: ExtendedClient,
  choice: FlipChoice,
  wagerInput: string,
  originalWager?: Currency,
): Promise<void> {
  let balance = client.economy.getBalance(interaction.user.id);
  const wager = new Currency(wagerInput, balance);
  originalWager ??= wager;

  if (wager.validity.code !== "valid") {
    interaction.reply(errorMessage(wager.validity.message));
    return;
  }
  const result = flipCoin();
  const win = result === choice;
  const netGain = win ? wager.value : -wager.value;
  balance += netGain;

  client.economy.addBalance(interaction.user.id, netGain);
  client.economy.addLog(interaction.user.id, "flip", netGain);

  const components = createActionRow({ wager, originalWager, balance });
  const embed = createEmbed({ user: interaction.user, choice, result, netGain, balance });

  const response = await interaction.reply({ embeds: [embed], components, fetchReply: true });
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
  const componentInteraction = await response.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

  let selected: ButtonSelection = "none";

  if (componentInteraction) {
    selected = componentInteraction.customId as ButtonSelection;

    let newWager = wager;

    if (selected === "double") {
      newWager = new Currency(wager.value * 2, balance);
    }

    if (selected === "originalWager") {
      newWager = new Currency(originalWager.value, balance);
      originalWager = newWager;
    }

    run(componentInteraction, client, choice, newWager.input, originalWager);
  }

  interaction.editReply({
    components: createActionRow({ selected, wager, originalWager }),
  });
}

const FlipChoiceSchema = z.enum(["heads", "tails"]);

type FlipChoice = z.infer<typeof FlipChoiceSchema>;

type ButtonSelection = "playAgain" | "double" | "originalWager" | "none";

type InitialActionRowOptions = {
  balance: number;
};

type FinalActionRowOptions = {
  selected: ButtonSelection;
};

type CreateActionRowOptions = {
  wager: Currency;
  originalWager: Currency;
  selected?: ButtonSelection;
} & (InitialActionRowOptions | FinalActionRowOptions);

function createActionRow(options: CreateActionRowOptions): ActionRowBuilder<ButtonBuilder>[] {
  const { wager, originalWager } = options;

  const playAgainButton = new ButtonBuilder()
    .setCustomId("playAgain")
    .setLabel("Play again" + (wager.allIn ? " (all in)" : ""))
    .setStyle(ButtonStyle.Primary);

  const doubleButton = new ButtonBuilder()
    .setCustomId("double")
    .setLabel("Play again (2x wager)")
    .setStyle(ButtonStyle.Danger);

  const originalWagerButton = new ButtonBuilder()
    .setCustomId("originalWager")
    .setLabel(`Play again (${originalWager.formatted})`)
    .setStyle(ButtonStyle.Secondary);

  switch (options.selected) {
    case "playAgain":
      playAgainButton.setStyle(ButtonStyle.Success).setDisabled(true);
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "double":
      doubleButton.setStyle(ButtonStyle.Success).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "originalWager":
      originalWagerButton.setStyle(ButtonStyle.Success).setDisabled(true);
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "none":
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
  }

  if (!options.selected && wager.value > options.balance)
    playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  if (!options.selected && wager.value * 2 > options.balance)
    doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  if (!options.selected && originalWager.value > options.balance)
    originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(playAgainButton, doubleButton);

  if (!wager.isEqual(originalWager) || wager.allIn) row.addComponents(originalWagerButton);

  return [row];
}

type CreateEmbedOptions = {
  user: User;
  choice: FlipChoice;
  result: FlipChoice;
  netGain: number;
  balance: number;
};

function createEmbed(options: CreateEmbedOptions): EmbedBuilder {
  const { user, choice, result, netGain, balance } = options;
  const win = result === choice;
  const description = `${bold(`You ${win ? "won" : "lost"}!`)} The coin landed on ${bold(result)}.`;
  const color = win ? "Green" : "Red";

  const embed = new EmbedBuilder()
    .setTitle("🪙 Coin Flip")
    .setDescription(description)
    .setColor(color)
    .addFields(
      { name: bold("Net Gain"), value: Currency.format(netGain), inline: true },
      { name: bold("Balance"), value: Currency.format(balance), inline: true },
    )
    .setFooter({ text: user.username, iconURL: user.displayAvatarURL() });

  return embed;
}

function flipCoin(): "heads" | "tails" {
  return Math.random() < 0.5 ? "heads" : "tails";
}

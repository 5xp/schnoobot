import CasinoLogger from "@common/CasinoLogger";
import Currency from "@common/Currency";
import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import * as sdb from "@db/services";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageComponentInteraction,
  User,
  bold,
} from "discord.js";
import numeral from "numeral";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const wagerInput = interaction.options.getString("wager", true);
  const targetMultiplier = interaction.options.getNumber("target", true);
  const logger = new CasinoLogger();

  run(interaction, client, logger, targetMultiplier, wagerInput);
}

async function run(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  client: ExtendedClient,
  logger: CasinoLogger,
  targetMultiplier: number,
  wagerInput: string,
  originalWager?: Currency,
): Promise<void> {
  let balance = await sdb.getBalance(interaction.user.id);
  const wager = new Currency(wagerInput, balance);
  originalWager ??= wager;

  if (wager.validity.code !== "valid") {
    interaction.reply(errorMessage(wager.validity.message));
    return;
  }

  const resultMultiplier = getLimboResult();
  const playAgainMultiplier = targetMultiplier / (targetMultiplier - 1);

  const win = targetMultiplier <= resultMultiplier;
  const netGain = win ? wager.value * (targetMultiplier - 1) : -wager.value;
  balance += netGain;

  sdb.addBalance(interaction.user.id, netGain);
  sdb.addLog(interaction.user.id, "limbo", netGain);
  logger.log(win, netGain, balance);

  const components = createActionRow({ multiplier: playAgainMultiplier, win, wager, originalWager, balance });
  const embed = createEmbed({ user: interaction.user, targetMultiplier, resultMultiplier, wager, balance });

  const isOriginalInteraction = interaction.isChatInputCommand();

  const response = await (isOriginalInteraction
    ? interaction.reply({ embeds: [embed], components })
    : interaction.update({ embeds: [logger.embed, embed], components }));

  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
  const componentInteraction = await response.awaitMessageComponent({ filter, time: 30_000 }).catch(() => null);

  let selected: ButtonSelection = "none";

  if (componentInteraction) {
    selected = componentInteraction.customId as ButtonSelection;

    let newWager = wager;

    if (selected === "multiplier") {
      newWager = new Currency(wager.value * playAgainMultiplier, balance);
    }

    if (selected === "originalWager") {
      newWager = new Currency(originalWager.value, balance);
      originalWager = newWager;
    }

    run(componentInteraction, client, logger, targetMultiplier, newWager.input, originalWager);
  } else {
    interaction.editReply({ components: [] });
  }
}

type ButtonSelection = "playAgain" | "multiplier" | "originalWager" | "none";

type InitialActionRowOptions = {
  balance: number;
};

type FinalActionRowOptions = {
  selected: ButtonSelection;
};

type CreateActionRowOptions = {
  wager: Currency;
  originalWager: Currency;
  win: boolean;
  multiplier: number;
  selected?: ButtonSelection;
} & (InitialActionRowOptions | FinalActionRowOptions);

function createActionRow(options: CreateActionRowOptions): ActionRowBuilder<ButtonBuilder>[] {
  const { selected, multiplier, win, wager, originalWager } = options;

  const playAgainButton = new ButtonBuilder()
    .setCustomId("playAgain")
    .setLabel("Play again" + (wager.allIn ? " (all in)" : ""))
    .setStyle(ButtonStyle.Primary);

  const multiplierButton = new ButtonBuilder()
    .setCustomId("multiplier")
    .setLabel(`Play again (${multiplier.toFixed(2)}x wager)`)
    .setStyle(ButtonStyle.Danger);

  const originalWagerButton = new ButtonBuilder()
    .setCustomId("originalWager")
    .setLabel(`Play again (${originalWager.formatted})`)
    .setStyle(ButtonStyle.Secondary);

  switch (selected) {
    case "playAgain":
      playAgainButton.setStyle(ButtonStyle.Success).setDisabled(true);
      multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "multiplier":
      multiplierButton.setStyle(ButtonStyle.Success).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "originalWager":
      originalWagerButton.setStyle(ButtonStyle.Success).setDisabled(true);
      multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "none":
      multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
  }

  if (!options.selected && wager.value > options.balance)
    playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  if (!options.selected && wager.value * multiplier > options.balance)
    multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  if (!options.selected && originalWager.value > options.balance)
    originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(playAgainButton);

  if (!win) row.addComponents(multiplierButton);

  if (!wager.isEqual(originalWager) || wager.allIn) row.addComponents(originalWagerButton);

  return [row];
}

type CreateEmbedOptions = {
  user: User;
  targetMultiplier: number;
  resultMultiplier: number;
  balance: number;
  wager: Currency;
};

function createEmbed(options: CreateEmbedOptions): EmbedBuilder {
  const { user, targetMultiplier, resultMultiplier, wager, balance } = options;
  const win = targetMultiplier <= resultMultiplier;

  const targetMultiplierFormatted = targetMultiplier.toFixed(2) + "x";
  const resultMultiplierFormatted = resultMultiplier.toFixed(2) + "x";

  const winChance = 1 / targetMultiplier;
  const winChanceFormatted = numeral(winChance).format("0.00%");

  const description = `${bold(`You ${win ? "won" : "lost"}!`)} The multiplier was ${bold(resultMultiplierFormatted)}.`;
  const netGain = win ? wager.value * (targetMultiplier - 1) : -wager.value;
  const color = win ? "Green" : "Red";

  const embed = new EmbedBuilder()
    .setTitle("🚀 Limbo")
    .setDescription(description)
    .setColor(color)
    .addFields(
      { name: bold("Wager"), value: wager.formatted, inline: true },
      { name: bold("Target Multiplier"), value: targetMultiplierFormatted, inline: true },
      { name: bold("Win Chance"), value: winChanceFormatted, inline: true },
      { name: bold("Net Gain"), value: Currency.format(netGain), inline: true },
      { name: bold("Balance"), value: Currency.format(balance), inline: true },
    )
    .setFooter({ text: user.username, iconURL: user.displayAvatarURL() });

  return embed;
}

function getLimboResult(): number {
  const result = 1 / Math.random();
  return Math.floor(result * 100) / 100;
}

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  bold,
  User,
  ColorResolvable,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
} from "discord.js";
import Currency from "@common/Currency";
import numeral from "numeral";
import ExtendedClient from "@common/ExtendedClient";

const gridSize = 5;
const factorial = [
  1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600, 6227020800, 87178291200, 1307674368000,
  20922789888000, 355687428096000, 6402373705728000, 121645100408832000, 2432902008176640000, 51090942171709440000,
  1124000727777607680000, 25852016738884976640000, 620448401733239439360000, 15511210043330985984000000,
];

const buttonStyleColors = new Map([
  [ButtonStyle.Primary, "#5865F2" as ColorResolvable],
  [ButtonStyle.Secondary, "#4E5058" as ColorResolvable],
  [ButtonStyle.Success, "#248046" as ColorResolvable],
  [ButtonStyle.Danger, "#DA373C" as ColorResolvable],
]);

type EmojiStylePair = { emoji: string; style: ButtonStyle };

const gemStyles: Array<EmojiStylePair> = [
  { emoji: "💎", style: ButtonStyle.Primary },
  { emoji: "🧊", style: ButtonStyle.Primary },
  { emoji: "💍", style: ButtonStyle.Primary },
  { emoji: "💵", style: ButtonStyle.Success },
  { emoji: "🍀", style: ButtonStyle.Success },
  { emoji: "🍉", style: ButtonStyle.Success },
];

const mineStyles: Array<EmojiStylePair> = [
  { emoji: "💣", style: ButtonStyle.Danger },
  { emoji: "☠️", style: ButtonStyle.Danger },
  { emoji: "⚡", style: ButtonStyle.Danger },
];

class MineGrid {
  gameOver = false;
  gameState = "playing";
  numCellsRevealed = 0;
  size: number;
  numMines: number;
  grid: Cell[][];
  gemStyle: EmojiStylePair;
  mineStyle: EmojiStylePair;

  constructor(size: number, numMines: number) {
    this.size = size;
    this.numMines = numMines;
    this.gemStyle = this.getGemStyle();
    this.mineStyle = this.getMineStyle();
    this.grid = this.initializeGrid();
  }

  get currentWinProbability() {
    return this.calculateWinProbability(this.numCellsRevealed + 1);
  }

  get nextMultiplier() {
    return 1 / this.currentWinProbability;
  }

  get lastWinProbability() {
    return this.calculateWinProbability(this.numCellsRevealed);
  }

  get currentMultiplier() {
    return 1 / this.lastWinProbability;
  }

  get nextTileChance() {
    return (this.sizeSquared - this.numCellsRevealed - this.numMines) / (this.sizeSquared - this.numCellsRevealed);
  }

  get cellActionRows() {
    const rows = [];
    for (const row of this.grid) {
      const components = [];
      for (const cell of row) {
        components.push(cell.button);
      }
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...components));
    }
    return rows;
  }

  get sizeSquared() {
    return this.size ** 2;
  }

  get buttons() {
    const gemButton = new ButtonBuilder().setEmoji(this.gemStyle.emoji).setStyle(this.gemStyle.style);
    const mineButton = new ButtonBuilder().setEmoji(this.mineStyle.emoji).setStyle(this.mineStyle.style);
    const unrevealedButton = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel("\u200b");

    return { gemButton, mineButton, unrevealedButton };
  }

  createOptionActionRow(options?: CreateActionRowOptions): ActionRowBuilder<ButtonBuilder>[] {
    if (!this.gameOver) {
      const cashOutButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Success)
        .setLabel("Cash out")
        .setCustomId("cashOut");
      return [new ActionRowBuilder<ButtonBuilder>().addComponents(cashOutButton)];
    }

    if (!options) {
      throw new Error("Missing required options");
    }

    const { selected, wager, originalWager } = options;

    const playAgainButton = new ButtonBuilder()
      .setCustomId("playAgain")
      .setLabel("Play again" + (wager.allIn ? " (all in)" : ""))
      .setStyle(ButtonStyle.Primary);

    const originalWagerButton = new ButtonBuilder()
      .setCustomId("originalWager")
      .setLabel(`Play again (${originalWager.formatted})`)
      .setStyle(ButtonStyle.Secondary);

    switch (selected) {
      case "playAgain":
        playAgainButton.setStyle(ButtonStyle.Success).setDisabled(true);
        originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
        break;
      case "originalWager":
        playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
        originalWagerButton.setStyle(ButtonStyle.Success).setDisabled(true);
        break;
      case "none":
        playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
        originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
        break;
    }

    if (!selected && wager.value > options.balance) {
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
    }

    if (!selected && originalWager.value > options.balance) {
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(playAgainButton);

    if (!wager.isEqual(originalWager) || wager.allIn) row.addComponents(originalWagerButton);

    return [row];
  }

  createEmbed(options: CreateEmbedOptions): EmbedBuilder {
    const { user, wager, balance } = options;

    const lastWinChanceFormatted = numeral(this.lastWinProbability).format("0.00%");
    const winChanceFormatted = numeral(this.currentWinProbability).format("0.00%");
    const nextTileChanceFormatted = numeral(this.nextTileChance).format("0.00%");
    const currentProfit = this.currentProfit(wager.value);
    const nextProfit = this.nextProfit(wager.value);
    const currentMultiplier = this.currentMultiplier;
    const nextMultiplier = this.nextMultiplier;

    const currentProfitString = `${Currency.format(currentProfit)} (${currentMultiplier.toFixed(2)}x)`;
    const nextProfitString = `${Currency.format(nextProfit)} (${nextMultiplier.toFixed(2)}x)`;

    let embed = new EmbedBuilder()
      .setTitle(`${this.mineStyle.emoji} Mines`)
      .addFields(
        { name: bold("Mines"), value: this.numMines.toString(), inline: true },
        { name: bold("Wager"), value: wager.formatted, inline: true },
      );

    switch (this.gameState) {
      case "playing":
        embed
          .setColor(buttonStyleColors.get(ButtonStyle.Secondary)!)
          .addFields(
            { name: bold(`Next ${this.gemStyle.emoji} %`), value: nextTileChanceFormatted, inline: true },
            { name: bold("Current Profit"), value: currentProfitString, inline: true },
            { name: bold("Next Tile Profit"), value: nextProfitString, inline: true },
          );
        break;
      case "win":
        embed
          .setColor(buttonStyleColors.get(this.gemStyle.style)!)
          .addFields(
            { name: bold("Balance"), value: Currency.format(balance + currentProfit), inline: true },
            { name: bold("Profit"), value: currentProfitString, inline: true },
            { name: bold("Win %"), value: lastWinChanceFormatted, inline: true },
          );
        break;
      case "lose":
      default:
        embed
          .setColor(buttonStyleColors.get(this.mineStyle.style)!)
          .addFields(
            { name: bold("Balance"), value: Currency.format(balance - wager.value), inline: true },
            { name: bold("Profit"), value: Currency.format(-wager.value), inline: true },
            { name: bold("Potential Profit"), value: currentProfitString, inline: true },
            { name: bold("Win %"), value: lastWinChanceFormatted, inline: true },
          );
        break;
    }

    embed.setFooter({ text: user.username, iconURL: user.displayAvatarURL() });

    return embed;
  }

  revealAll() {
    for (const row of this.grid) {
      for (const cell of row) {
        cell.revealed = true;
      }
    }
  }

  disableUnrevealed() {
    for (const row of this.grid) {
      for (const cell of row) {
        if (!cell.revealed) cell.disabled = true;
      }
    }
  }

  getCell(index: number) {
    const x = Math.floor(index / this.size);
    const y = index % this.size;
    return this.grid[x][y];
  }

  onGameOver() {
    this.gameOver = true;
    this.disableUnrevealed();
    this.revealAll();
  }

  cashOut() {
    this.gameState = "win";
    this.onGameOver();
  }

  nextProfit(wager: number) {
    return wager * this.nextMultiplier - wager;
  }

  currentProfit(wager: number) {
    return wager * this.currentMultiplier - wager;
  }

  private initializeGrid(): Cell[][] {
    const grid: Cell[][] = [];
    for (let i = 0; i < this.size; i++) {
      grid[i] = new Array(this.size);
      for (let j = 0; j < this.size; j++) {
        grid[i][j] = new Cell(i, j, this);
      }
    }

    this.placeMines(grid);

    return grid;
  }

  private placeMines(grid: Cell[][]) {
    const numCells = this.sizeSquared;
    const mineIndices = new Set<number>();

    while (mineIndices.size < this.numMines) {
      mineIndices.add(Math.floor(Math.random() * numCells));
    }

    for (const index of mineIndices) {
      const x = Math.floor(index / this.size);
      const y = index % this.size;
      grid[x][y].isMine = true;
    }
  }

  private getGemStyle(): EmojiStylePair {
    return gemStyles[Math.floor(Math.random() * gemStyles.length)];
  }

  private getMineStyle(): EmojiStylePair {
    return mineStyles[Math.floor(Math.random() * mineStyles.length)];
  }

  private calculateWinProbability(numCellsRevealed: number) {
    return (
      (factorial[this.sizeSquared - this.numMines] * factorial[this.sizeSquared - numCellsRevealed]) /
      (factorial[this.sizeSquared] * factorial[this.sizeSquared - (this.numMines + numCellsRevealed)])
    );
  }
}

class Cell {
  x: number;
  y: number;
  grid: MineGrid;
  isMine: boolean;
  revealed: boolean;
  disabled: boolean;
  gemButton!: ButtonBuilder;
  mineButton!: ButtonBuilder;
  unrevealedButton!: ButtonBuilder;

  constructor(x: number, y: number, grid: MineGrid) {
    this.x = x;
    this.y = y;
    this.grid = grid;
    this.isMine = false;
    this.revealed = false;
    this.disabled = false;
    Object.assign(this, grid.buttons);
  }

  get id() {
    return String(this.x * gridSize + this.y);
  }

  get button() {
    const button = this.revealed ? (this.isMine ? this.mineButton : this.gemButton) : this.unrevealedButton;

    return new ButtonBuilder(button.toJSON()).setCustomId(this.id).setDisabled(this.disabled);
  }

  onClick() {
    if (this.revealed) {
      this.grid.cashOut();
      return;
    }

    this.revealed = true;
    this.grid.numCellsRevealed++;

    if (this.isMine) {
      this.grid.gameState = "lose";
      this.grid.onGameOver();
      return;
    }

    if (this.grid.numCellsRevealed === this.grid.sizeSquared - this.grid.numMines) {
      this.grid.gameState = "win";
      this.grid.onGameOver();
      return;
    }
  }
}

type ButtonSelection = "playAgain" | "originalWager" | "none";

type InitialActionRowOptions = {
  balance: number;
};

type FinalActionRowOptions = {
  selected: ButtonSelection;
};

type CreateActionRowOptions = {
  user: User;
  wager: Currency;
  originalWager: Currency;
  selected?: ButtonSelection;
} & (InitialActionRowOptions | FinalActionRowOptions);

type CreateEmbedOptions = {
  user: User;
  wager: Currency;
  balance: number;
};

export default async function execute(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  client: ExtendedClient,
  numMines?: number,
  wager?: Currency | string,
  originalWager?: Currency,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    wager ??= interaction.options.getString("wager", true);
    numMines ??= interaction.options.getNumber("mines", true);
  }

  if (!wager || !numMines) {
    throw new Error("Missing required parameters");
  }

  let balance = client.economy.getBalance(interaction.user.id);
  wager = new Currency(wager, balance);
  originalWager ??= wager;

  if (wager.validity.code !== "valid") {
    interaction.reply({ content: bold(wager.validity.message), ephemeral: true });
    return;
  }

  const grid = new MineGrid(gridSize, numMines);
  const embed = grid.createEmbed({ user: interaction.user, wager, balance });
  const gridResponse = await interaction.reply({ embeds: [embed], components: grid.cellActionRows, fetchReply: true });
  const optionResponse = await interaction.followUp({
    components: grid.createOptionActionRow(),
    fetchReply: true,
  });

  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
  const time = 3_600_000;
  const gridComponentCollector = gridResponse.createMessageComponentCollector({ filter, time });
  const cashOutCollector = optionResponse.createMessageComponentCollector({ filter, time, max: 1 });

  async function handleGameOver() {
    gridComponentCollector.stop();
    cashOutCollector.stop();
    wager = <Currency>wager;
    originalWager = <Currency>originalWager;

    const netGain = grid.gameState === "win" ? grid.currentProfit(wager.value) : -wager.value;
    balance += netGain;

    client.economy.addBalance(interaction.user.id, netGain);
    client.economy.addLog(interaction.user.id, "mines", netGain);

    const optionInteraction = await optionResponse.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

    let selected: ButtonSelection = "none";

    if (optionInteraction) {
      selected = optionInteraction.customId as ButtonSelection;

      let newWager = wager;

      if (selected === "originalWager") {
        newWager = new Currency(originalWager!.value, balance);
        originalWager = newWager;
      }

      execute(optionInteraction, client, numMines, newWager, originalWager);
    }

    optionResponse.edit({
      components: grid.createOptionActionRow({ user: interaction.user, wager, balance, originalWager, selected }),
    });
  }

  gridComponentCollector.on("collect", async (i: MessageComponentInteraction) => {
    const cell = grid.getCell(Number(i.customId));
    cell.onClick();
    gridComponentCollector.resetTimer();
    cashOutCollector.resetTimer();
    wager = <Currency>wager;
    originalWager = <Currency>originalWager;

    const embed = grid.createEmbed({ user: interaction.user, wager, balance });
    i.update({ embeds: [embed], components: grid.cellActionRows });

    if (grid.gameOver) {
      optionResponse.edit({
        components: grid.createOptionActionRow({ user: interaction.user, wager, balance, originalWager }),
      });

      handleGameOver();
    }
  });

  cashOutCollector.on("collect", async i => {
    grid.cashOut();
    wager = <Currency>wager;
    originalWager = <Currency>originalWager;

    const embed = grid.createEmbed({ user: interaction.user, wager, balance });
    gridResponse.edit({ embeds: [embed], components: grid.cellActionRows });
    i.update({ components: grid.createOptionActionRow({ user: interaction.user, wager, balance, originalWager }) });

    handleGameOver();
  });

  gridComponentCollector.on("end", async (_, reason) => {
    if (reason !== "time") return;
    wager = <Currency>wager;
    originalWager = <Currency>originalWager;

    grid.cashOut();

    const embed = grid.createEmbed({ user: interaction.user, wager, balance });
    gridResponse.edit({ embeds: [embed], components: grid.cellActionRows });
    optionResponse.edit({
      components: grid.createOptionActionRow({ user: interaction.user, wager, balance, originalWager }),
    });

    handleGameOver();
  });
}

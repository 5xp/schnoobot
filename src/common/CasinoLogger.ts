import Currency from "./Currency";
import { codeBlock, EmbedBuilder } from "discord.js";

type Log = {
  win: boolean;
  netGain: number;
  balance: number;
};

export default class CasinoLogger {
  logs: Log[] = [];

  log(win: boolean, netGain: number, balance: number) {
    this.logs.push({ win, netGain, balance });
  }

  get totalNetGain() {
    return this.logs.reduce((acc, log) => acc + log.netGain, 0);
  }

  get winRate() {
    const wins = this.logs.filter(log => log.win).length;
    return wins / this.logs.length;
  }

  get embed() {
    const embed = new EmbedBuilder();

    let description = codeBlock("md", tabulate(["#️⃣", "🔵", "Net Gain", "Balance"], [1, 1, 8, 8]));

    this.logs.forEach((log, index) => {
      if (index < this.logs.length - 10) return;

      description += codeBlock(
        tabulate(
          [
            `${index + 1}`,
            log.win ? "🟢" : "🔴",
            Currency.format(log.netGain, "$0.00a"),
            Currency.format(log.balance, "$0.00a"),
          ],
          [2, 1, 8, 8],
        ),
      );
    });

    embed.setDescription(description);

    embed.setFooter({
      text: `Net Gain: ${Currency.format(this.totalNetGain, "$0.00a")} ● Win Rate: ${(this.winRate * 100).toFixed(1)}%`,
    });

    return embed;
  }
}

function tabulate(strings: string[], lengths: number[]) {
  return strings.map((str, i) => str.padEnd(lengths[i])).join(" ");
}

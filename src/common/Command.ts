import { SlashCommandBuilder } from "discord.js";

export default interface Command {
  data: SlashCommandBuilder;
  execute(...args: any): any;
  devOnly?: boolean;
  filePath?: string;
}

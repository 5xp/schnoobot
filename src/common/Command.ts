import { SlashCommandBuilder } from "discord.js";

export default interface Command {
  data: SlashCommandBuilder;
  execute(...args: any): any;
  autocomplete?(...args: any): any;
  isUserCommand?: boolean;
  devOnly?: boolean;
  filePath?: string;
}

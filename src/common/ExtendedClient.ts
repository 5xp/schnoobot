import fs from "fs";
import path from "path";
import { Client, ClientOptions, Collection } from "discord.js";
import Command from "./Command";
import EconomyManager from "../libs/EconomyManager";

export default class ExtendedClient extends Client {
  commands: Collection<string, Command> = new Collection();
  economy: EconomyManager = new EconomyManager();

  constructor(options: ClientOptions) {
    super(options);
  }

  async init(): Promise<void> {
    this.commands = await ExtendedClient.loadCommands(path.join(__dirname, "..", "commands"));
    this.loadEvents(path.join(__dirname, "..", "events"));
  }

  static async loadCommands(dir: string): Promise<Collection<string, Command>> {
    let commands = new Collection<string, Command>();
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.lstatSync(filePath);

      if (stat.isDirectory()) {
        const nestedCommands = await this.loadCommands(filePath);
        commands = commands.concat(nestedCommands);
      } else {
        const commandModule = await import(filePath);
        const command: Command = commandModule.default;

        if (!command.data || !command.execute) continue;

        command.filePath = filePath;

        commands.set(command.data.name, command);
      }
    }

    return commands;
  }

  private async loadEvents(dir: string): Promise<void> {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(__dirname, "..", "events", file);
      const eventModule = await import(filePath);

      const event = eventModule.default;

      if (event.once) {
        this.once(event.name, (...args) => event.execute(...args));
      } else {
        this.on(event.name, (...args) => event.execute(...args));
      }
    }
  }
}

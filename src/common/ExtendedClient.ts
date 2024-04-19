import {
  Client,
  ClientOptions,
  Collection,
  REST,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
} from "discord.js";
import { ENV } from "env";
import fs from "fs";
import path from "path";
import Command from "./Command";
import EconomyManager from "./EconomyManager";

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

        if (!command || !command.data || !command.execute) continue;

        command.filePath = filePath;

        commands.set(command.data.name, command);
      }
    }

    return commands;
  }

  static async deployCommands(options: CommandDeployOptions): Promise<string> {
    const rest = new REST({ version: "10" }).setToken(ENV.DISCORD_TOKEN);
    const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    const commandsCollection = await this.loadCommands(path.join(__dirname, "..", "commands"));

    commandsCollection.forEach(command => {
      if (command.devOnly && options.global) return;

      let json = command.data.toJSON();

      // Temporary hack for enabling user commands
      if (command.isUserCommand) {
        // @ts-ignore
        json = { ...json, integration_types: [0, 1], contexts: [0, 1, 2] };
      }

      commands.push(json);
    });

    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    let data: any;

    if (options.global) {
      data = await rest.put(Routes.applicationCommands(ENV.CLIENT_ID), { body: commands });
      return "Successfully deployed global commands.";
    } else {
      data = await rest.put(Routes.applicationGuildCommands(ENV.CLIENT_ID, options.guildId), { body: commands });
      return `Successfully deployed guild commands to ${options.guildId}.`;
    }
  }

  static async clearCommands(options: CommandDeployOptions): Promise<string> {
    const rest = new REST({ version: "10" }).setToken(ENV.DISCORD_TOKEN);

    if (options.global) {
      await rest.put(Routes.applicationCommands(ENV.CLIENT_ID), { body: [] });
      return "Successfully cleared global commands.";
    } else {
      await rest.put(Routes.applicationGuildCommands(ENV.CLIENT_ID, options.guildId), { body: [] });
      return `Successfully cleared guild commands from ${options.guildId}.`;
    }
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

type CommandDeployOptions =
  | {
      global: false;
      guildId: string;
    }
  | {
      global: true;
    };

import {
	Client,
	ClientOptions,
	Collection,
	formatEmoji,
	REST,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	Routes,
} from "discord.js";
import { RawEmojiData } from "discord.js/typings/rawDataTypes";
import { ENV } from "env";
import fs from "fs";
import path from "path";
import Command from "./Command";

export const applicationEmojis = new Collection<string, string>();

export default class ExtendedClient extends Client {
	commands: Collection<string, Command> = new Collection();

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

	async loadEmojis(client: ExtendedClient): Promise<void> {
		// Temporary hack for loading application emojis
		const rest = new REST({ version: "10" }).setToken(ENV.DISCORD_TOKEN);

		if (!client.application) {
			console.error("Client application not found.");
			return;
		}

		const emojiData = (await rest.get(`/applications/${client.application.id}/emojis`)) as {
			items: RawEmojiData[];
		};

		if (!emojiData) {
			console.error("Emojis not found.");
			return;
		}

		const emojis = emojiData.items;

		emojis.forEach(emoji => {
			if (!emoji.name || !emoji.id) return;
			applicationEmojis.set(emoji.name, formatEmoji(emoji.id));
		});
	}

	static async deployCommands(options: CommandDeployOptions): Promise<string> {
		const rest = new REST({ version: "10" }).setToken(ENV.DISCORD_TOKEN);
		const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
		const commandsCollection = await this.loadCommands(path.join(__dirname, "..", "commands"));

		commandsCollection.forEach(command => {
			if (command.devOnly && options.global) return;

			const json = command.data.toJSON();

			commands.push(json);
		});

		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		if (options.global) {
			await rest.put(Routes.applicationCommands(ENV.CLIENT_ID), { body: commands });
			return "Successfully deployed global commands.";
		} else {
			await rest.put(Routes.applicationGuildCommands(ENV.CLIENT_ID, options.guildId), { body: commands });
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

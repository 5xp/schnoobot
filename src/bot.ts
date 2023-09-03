import ExtendedClient from "@common/ExtendedClient";
import { GatewayIntentBits } from "discord.js";
import "env";

const client = new ExtendedClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers],
  rest: {
    timeout: 80_000,
  },
});

client.init();
client.login();

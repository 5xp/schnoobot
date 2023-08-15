import { Events } from "discord.js";
import ExtendedClient from "@common/ExtendedClient";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: ExtendedClient) {
    console.log(`Logged in as ${client.user?.tag}!`);
    client.application?.fetch();
  },
};

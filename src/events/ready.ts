import ExtendedClient from "@common/ExtendedClient";
import { Events } from "discord.js";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: ExtendedClient) {
    console.log(`Logged in as ${client.user?.tag}!`);
    client.application?.fetch();
  },
};

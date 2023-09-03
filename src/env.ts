import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

config({ path: resolve(process.cwd(), ".env") });

const envSchema = z.object({
  DISCORD_TOKEN: z.string(),
  CLIENT_ID: z.string(),
  GUILD_ID: z.string().optional(),
});

export const ENV = envSchema.parse(process.env);

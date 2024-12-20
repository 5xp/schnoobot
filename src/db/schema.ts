import { InferSelectModel } from "drizzle-orm";
import { int, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  userId: text("user_id").primaryKey(),
  balance: numeric().default("0").notNull(),
  lastDaily: int("last_daily").default(0),
  dailyStreak: int("daily_streak").default(0).notNull(),
  totalDaily: int("total_daily").default(0).notNull(),
  highestStreak: int("highest_streak").default(0).notNull(),
});

export type User = InferSelectModel<typeof users>;

export const casinoLogs = sqliteTable("casino_logs", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  game: text().notNull(),
  netGain: numeric("net_gain").notNull(),
  timestamp: text().notNull(),
});

export type CasinoLog = InferSelectModel<typeof casinoLogs>;

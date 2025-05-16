import { drizzle } from "drizzle-orm/better-sqlite3";
import { ENV } from "env";
import * as schema from "./schema";

const db = drizzle({ schema, connection: ENV.DB_FILE_NAME });

export default db;

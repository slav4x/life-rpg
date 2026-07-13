import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/** A transaction handle, structurally usable anywhere a `Database` is. */
export type Transaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

/** Accepted by repositories so they work both standalone and inside a tx. */
export type DbClient = Database | Transaction;

type SqlClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as typeof globalThis & {
  lifeRpgSql?: SqlClient;
  lifeRpgDatabase?: Database;
};

let sql = globalForDb.lifeRpgSql;
let database = globalForDb.lifeRpgDatabase;

/**
 * Lazily-initialised Drizzle client. Kept lazy so `next build` and unit tests
 * never open a connection unless a query is actually run.
 */
export function getDb(): Database {
  if (!database) {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    sql = postgres(env.DATABASE_URL, { max: 10 });
    database = drizzle(sql, { schema });
    globalForDb.lifeRpgSql = sql;
    globalForDb.lifeRpgDatabase = database;
  }
  return database;
}

/** Close the pool. Used by tests and graceful shutdown. */
export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = undefined;
    database = undefined;
    globalForDb.lifeRpgSql = undefined;
    globalForDb.lifeRpgDatabase = undefined;
  }
}

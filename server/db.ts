import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Tiny document store on Node's built-in SQLite (no install). Each table holds JSON documents,
 * which keeps the schema in shared/contract.ts instead of in SQL.
 */
export type Table = 'messages' | 'activity' | 'conversations' | 'push_subs';

export class Db {
  private readonly sql: DatabaseSync;

  constructor(dir: string | ':memory:') {
    if (dir === ':memory:') this.sql = new DatabaseSync(':memory:');
    else {
      mkdirSync(dir, { recursive: true });
      this.sql = new DatabaseSync(join(dir, 'engie360.db'));
    }
    this.sql.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS docs (tbl TEXT NOT NULL, id TEXT NOT NULL, sort TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (tbl, id));
      CREATE INDEX IF NOT EXISTS docs_sort ON docs (tbl, sort);
    `);
  }

  get<T>(key: string): T | undefined {
    const row = this.sql.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  set<T>(key: string, value: T): void {
    this.sql.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  }

  /** Insert or replace a document; `sort` orders lists (ISO timestamps sort correctly). */
  put<T>(tbl: Table, id: string, sort: string, doc: T): void {
    this.sql
      .prepare('INSERT INTO docs (tbl, id, sort, json) VALUES (?, ?, ?, ?) ON CONFLICT(tbl, id) DO UPDATE SET sort = excluded.sort, json = excluded.json')
      .run(tbl, id, sort, JSON.stringify(doc));
  }

  find<T>(tbl: Table, id: string): T | undefined {
    const row = this.sql.prepare('SELECT json FROM docs WHERE tbl = ? AND id = ?').get(tbl, id) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as T) : undefined;
  }

  /** Newest first. */
  list<T>(tbl: Table, limit = 500): T[] {
    const rows = this.sql.prepare('SELECT json FROM docs WHERE tbl = ? ORDER BY sort DESC LIMIT ?').all(tbl, limit) as { json: string }[];
    return rows.map((r) => JSON.parse(r.json) as T);
  }

  remove(tbl: Table, id: string): void {
    this.sql.prepare('DELETE FROM docs WHERE tbl = ? AND id = ?').run(tbl, id);
  }

  clear(tbl: Table): void {
    this.sql.prepare('DELETE FROM docs WHERE tbl = ?').run(tbl);
  }

  count(tbl: Table): number {
    return (this.sql.prepare('SELECT COUNT(*) AS n FROM docs WHERE tbl = ?').get(tbl) as { n: number }).n;
  }

  close(): void {
    this.sql.close();
  }
}

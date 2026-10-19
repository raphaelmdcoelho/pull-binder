import { Provider } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../app/core/supabase/supabase.client';

type Row = Record<string, unknown>;
interface Result {
  data: unknown;
  error: { code: string; message: string } | null;
}

const IDENTITY = ['card_id', 'language', 'condition', 'finish'];

/**
 * A tiny in-memory stand-in for the owned_cards table behind supabase-js: unique identity key,
 * eq/match filters, insert/update/select with single and maybeSingle. Enough to exercise the
 * repository's merge logic; RLS is covered by the SQL tests and the local-stack script.
 */
export class FakeOwnedTable {
  rows: Row[] = [];
  /** Runs right before every update, to simulate another tab changing a row. */
  beforeUpdate: (() => void) | null = null;
  failWith: { code: string; message: string } | null = null;
  private seq = 0;

  from(): Query {
    return new Query(this);
  }

  /** Used by Query. */
  nextId(): string {
    return `row-${++this.seq}`;
  }

  asClient(): SupabaseClient {
    return { from: () => this.from() } as unknown as SupabaseClient;
  }
}

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row = {};
  private filters: [string, unknown][] = [];
  private patterns: [string, RegExp][] = [];
  private orders: [string, boolean][] = [];
  private window: [number, number] | null = null;
  private columns: string[] | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';

  constructor(private readonly table: FakeOwnedTable) {}

  insert(payload: Row): this {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: Row): this {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  delete(): this {
    this.op = 'delete';
    return this;
  }
  select(columns?: string): this {
    if (columns) this.columns = columns.split(',').map((c) => c.trim());
    return this;
  }
  ilike(column: string, pattern: string): this {
    // % is any run, _ any char, backslash escapes: enough for what the repository sends.
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === '\\') source += (pattern[++i] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      else if (ch === '%') source += '.*';
      else if (ch === '_') source += '.';
      else source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    this.patterns.push([column, new RegExp(`^${source}$`, 'i')]);
    return this;
  }
  range(from: number, to: number): this {
    this.window = [from, to];
    return this;
  }
  match(filter: Row): this {
    this.filters.push(...Object.entries(filter));
    return this;
  }
  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push([column, options?.ascending ?? true]);
    return this;
  }
  limit(): this {
    return this;
  }
  single(): this {
    this.mode = 'single';
    return this;
  }
  maybeSingle(): this {
    this.mode = 'maybe';
    return this;
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return (
      this.filters.every(([column, value]) => row[column] === value) &&
      this.patterns.every(([column, pattern]) => pattern.test(String(row[column] ?? '')))
    );
  }

  private shape(rows: Row[]): Result {
    if (this.mode === 'many') return { data: rows, error: null };
    if (rows.length === 0) {
      return this.mode === 'maybe'
        ? { data: null, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    return { data: rows[0], error: null };
  }

  private run(): Result {
    const { table } = this;
    if (table.failWith) return { data: null, error: table.failWith };
    if (this.op === 'insert') {
      const clash = table.rows.some((row) => IDENTITY.every((c) => row[c] === this.payload[c]));
      if (clash) return { data: null, error: { code: '23505', message: 'duplicate key value' } };
      const quantity = this.payload['quantity'] as number;
      if (quantity < 1 || quantity > 9999) {
        return { data: null, error: { code: '23514', message: 'check constraint' } };
      }
      const row = { id: table.nextId(), updated_at: new Date().toISOString(), ...this.payload };
      table.rows.push(row);
      return this.shape([row]);
    }
    if (this.op === 'update') {
      table.beforeUpdate?.();
      table.beforeUpdate = null;
      const hit = table.rows.filter((row) => this.matches(row));
      for (const row of hit) {
        const next = { ...row, ...this.payload };
        const clash = table.rows.some(
          (other) => other !== row && IDENTITY.every((c) => other[c] === next[c]),
        );
        if (clash) return { data: null, error: { code: '23505', message: 'duplicate key value' } };
        const quantity = next['quantity'] as number;
        if (quantity < 1 || quantity > 9999) {
          return { data: null, error: { code: '23514', message: 'check constraint' } };
        }
        Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
      }
      return this.shape(hit);
    }
    if (this.op === 'delete') {
      const gone = table.rows.filter((row) => this.matches(row));
      table.rows = table.rows.filter((row) => !gone.includes(row));
      return this.shape(gone);
    }
    let rows = table.rows.filter((row) => this.matches(row));
    rows.sort((a, b) => {
      for (const [column, ascending] of this.orders) {
        const x = a[column];
        const y = b[column];
        const cmp =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x ?? '').localeCompare(String(y ?? ''));
        if (cmp !== 0) return ascending ? cmp : -cmp;
      }
      return 0;
    });
    if (this.window) rows = rows.slice(this.window[0], this.window[1] + 1);
    const columns = this.columns;
    if (columns) rows = rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c]])));
    return this.shape(rows);
  }
}

export function provideFakeOwnedTable(table: FakeOwnedTable): Provider {
  return { provide: SUPABASE, useValue: table.asClient() };
}

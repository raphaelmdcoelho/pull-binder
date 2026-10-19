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
  private op: 'select' | 'insert' | 'update' = 'select';
  private payload: Row = {};
  private filters: [string, unknown][] = [];
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private ordered = false;

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
  select(_columns?: string): this {
    void _columns;
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
  order(): this {
    this.ordered = true;
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
    return this.filters.every(([column, value]) => row[column] === value);
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
      hit.forEach((row) =>
        Object.assign(row, this.payload, { updated_at: new Date().toISOString() }),
      );
      return this.shape(hit);
    }
    const rows = table.rows.filter((row) => this.matches(row));
    if (this.ordered)
      rows.sort((a, b) => String(b['updated_at']).localeCompare(String(a['updated_at'])));
    return this.shape(rows);
  }
}

export function provideFakeOwnedTable(table: FakeOwnedTable): Provider {
  return { provide: SUPABASE, useValue: table.asClient() };
}

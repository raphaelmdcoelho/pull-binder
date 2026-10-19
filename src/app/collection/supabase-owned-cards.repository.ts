import { Injectable, inject } from '@angular/core';
import { PostgrestError } from '@supabase/supabase-js';
import { SUPABASE } from '../core/supabase/supabase.client';
import { Finish } from '../catalog/card.model';
import {
  AddOwnedCardInput,
  CardLanguage,
  CollectionPage,
  CollectionQuery,
  CollectionSummary,
  Condition,
  MAX_QUANTITY,
  OwnedCard,
  OwnedCardUpdate,
  SetOption,
  UpdateResult,
} from './owned-card.model';
import { OwnedCardsError, OwnedCardsRepository } from './owned-cards.repository';

interface Row {
  id: string;
  card_id: string;
  language: string;
  condition: Condition;
  finish: Finish;
  quantity: number;
  card_name: string;
  card_number: string | null;
  set_id: string;
  set_name: string;
  image_url: string | null;
  updated_at: string;
}

const COLUMNS =
  'id, card_id, language, condition, finish, quantity, card_name, card_number, set_id, set_name, image_url, updated_at';
const MAX_ATTEMPTS = 4;
const CHUNK = 1000; // PostgREST's default max rows per response
const MAX_CHUNKS = 50; // safety stop for the summary and set scans

@Injectable()
export class SupabaseOwnedCardsRepository extends OwnedCardsRepository {
  private readonly supabase = inject(SUPABASE);

  async add(input: AddOwnedCardInput): Promise<OwnedCard> {
    const { card } = input;
    const snapshot = {
      card_name: card.name,
      card_number: card.number,
      set_id: card.setId,
      set_name: card.setName,
      image_url: card.imageBase,
    };
    const key = {
      card_id: card.id,
      language: input.language,
      condition: input.condition,
      finish: input.finish,
    };

    // user_id is filled by the column default (auth.uid()), and RLS rejects anything else.
    const inserted = await this.supabase
      .from('owned_cards')
      .insert({ ...key, ...snapshot, quantity: input.quantity })
      .select(COLUMNS)
      .single();
    if (!inserted.error) return fromRow(inserted.data as Row);
    if (inserted.error.code !== '23505') throw toError(inserted.error);

    // The same Owned card exists: add to its quantity. The update only applies if nobody changed
    // the quantity since we read it, so two quick taps cannot lose copies.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const found = await this.supabase
        .from('owned_cards')
        .select('id, quantity')
        .match(key)
        .maybeSingle();
      if (found.error) throw toError(found.error);
      if (!found.data) {
        // Deleted between the insert and now (another tab): start over as a plain insert.
        return this.add(input);
      }
      const next = found.data.quantity + input.quantity;
      if (next > MAX_QUANTITY) throw new OwnedCardsError('quantity-limit');
      const updated = await this.supabase
        .from('owned_cards')
        .update({ quantity: next, ...snapshot })
        .eq('id', found.data.id)
        .eq('quantity', found.data.quantity)
        .select(COLUMNS);
      if (updated.error) throw toError(updated.error);
      if (updated.data.length === 1) return fromRow(updated.data[0] as Row);
    }
    throw new OwnedCardsError('unknown');
  }

  async list(
    query: CollectionQuery,
    page: { offset: number; limit: number },
  ): Promise<CollectionPage> {
    // One extra row tells us whether another page exists without a count query.
    let request = applyFilters(this.table(COLUMNS), query);
    for (const [column, ascending] of ORDER[query.sort]) {
      request = request.order(column, { ascending });
    }
    const { data, error } = await request.order('id').range(page.offset, page.offset + page.limit);
    if (error) throw toError(error);
    const rows = data as Row[];
    return { items: rows.slice(0, page.limit).map(fromRow), hasMore: rows.length > page.limit };
  }

  /** The select builder typed as the few methods used here (the full generic type is very deep). */
  private table(columns: string): QueryLike {
    return this.supabase.from('owned_cards').select(columns) as unknown as QueryLike;
  }

  async summarize(query: CollectionQuery): Promise<CollectionSummary> {
    let entries = 0;
    let copies = 0;
    for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
      const { data, error } = await applyFilters(this.table('quantity'), query)
        .order('id')
        .range(chunk * CHUNK, (chunk + 1) * CHUNK - 1);
      if (error) throw toError(error);
      const rows = data as { quantity: number }[];
      entries += rows.length;
      copies += rows.reduce((sum, row) => sum + row.quantity, 0);
      if (rows.length < CHUNK) break;
    }
    return { entries, copies };
  }

  async listSets(): Promise<SetOption[]> {
    const sets = new Map<string, string>();
    for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
      const { data, error } = await this.supabase
        .from('owned_cards')
        .select('set_id, set_name')
        .order('id')
        .range(chunk * CHUNK, (chunk + 1) * CHUNK - 1);
      if (error) throw toError(error);
      const rows = data as { set_id: string; set_name: string }[];
      rows.forEach((row) => sets.set(row.set_id, row.set_name));
      if (rows.length < CHUNK) break;
    }
    return [...sets]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async update(id: string, patch: OwnedCardUpdate): Promise<UpdateResult> {
    const { data: current, error } = await this.supabase
      .from('owned_cards')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw toError(error);
    if (!current) throw new OwnedCardsError('not-found');
    const row = current as Row;
    const quantity = patch.quantity ?? row.quantity;
    if (quantity < 1 || quantity > MAX_QUANTITY) throw new OwnedCardsError('quantity-limit');

    const values: { quantity: number; condition?: Condition } = { quantity };
    if (patch.condition) values.condition = patch.condition;
    const updated = await this.supabase
      .from('owned_cards')
      .update(values)
      .eq('id', id)
      .select(COLUMNS);
    if (!updated.error) {
      if (updated.data.length === 0) throw new OwnedCardsError('not-found');
      return { card: fromRow(updated.data[0] as Row), merged: false };
    }
    if (updated.error.code !== '23505' || !patch.condition) throw toError(updated.error);
    return { card: await this.mergeInto(row, patch.condition, quantity), merged: true };
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('owned_cards')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw toError(error);
    if (data.length === 0) throw new OwnedCardsError('not-found');
  }

  /**
   * The new Condition already exists for this card, Language and Finish: add the copies to that
   * row, then delete this one. If the delete fails the target is put back, so copies are never
   * counted twice or lost (an atomic RPC would remove the window; see the plan).
   */
  private async mergeInto(row: Row, condition: Condition, quantity: number): Promise<OwnedCard> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const target = await this.supabase
        .from('owned_cards')
        .select(COLUMNS)
        .match({ card_id: row.card_id, language: row.language, finish: row.finish, condition })
        .maybeSingle();
      if (target.error) throw toError(target.error);
      if (!target.data) throw new OwnedCardsError('not-found');
      const existing = target.data as Row;
      const total = existing.quantity + quantity;
      if (total > MAX_QUANTITY) throw new OwnedCardsError('quantity-limit');
      const bumped = await this.supabase
        .from('owned_cards')
        .update({ quantity: total })
        .eq('id', existing.id)
        .eq('quantity', existing.quantity)
        .select(COLUMNS);
      if (bumped.error) throw toError(bumped.error);
      if (bumped.data.length !== 1) continue; // changed meanwhile: read again
      const removed = await this.supabase.from('owned_cards').delete().eq('id', row.id);
      if (removed.error) {
        await this.supabase
          .from('owned_cards')
          .update({ quantity: existing.quantity })
          .eq('id', existing.id)
          .eq('quantity', total);
        throw toError(removed.error);
      }
      return fromRow(bumped.data[0] as Row);
    }
    throw new OwnedCardsError('unknown');
  }
}

/** [column, ascending] pairs per sort; `id` is appended as the final tie-breaker. */
const ORDER: Record<CollectionQuery['sort'], [string, boolean][]> = {
  updated: [['updated_at', false]],
  name: [
    ['card_name', true],
    ['set_name', true],
    ['card_number', true],
  ],
  set: [
    ['set_name', true],
    ['card_number', true],
    ['card_name', true],
  ],
  quantity: [
    ['quantity', false],
    ['card_name', true],
  ],
};

interface QueryLike extends PromiseLike<unknown> {
  ilike(column: string, pattern: string): QueryLike;
  eq(column: string, value: string): QueryLike;
  order(column: string, options?: { ascending: boolean }): QueryLike;
  range(from: number, to: number): PromiseLike<{ data: unknown; error: PostgrestError | null }>;
}

/** Filters run in the database; the user_id restriction comes from row-level security. */
function applyFilters(builder: QueryLike, query: CollectionQuery): QueryLike {
  let b = builder;
  const text = query.text.trim();
  if (text) b = b.ilike('card_name', `%${text.replace(/[\\%_]/g, '\\$&')}%`);
  if (query.setId) b = b.eq('set_id', query.setId);
  if (query.condition) b = b.eq('condition', query.condition);
  if (query.language) b = b.eq('language', query.language);
  if (query.finish) b = b.eq('finish', query.finish);
  return b;
}

function fromRow(row: Row): OwnedCard {
  return {
    id: row.id,
    cardId: row.card_id,
    language: row.language as CardLanguage,
    condition: row.condition,
    finish: row.finish,
    quantity: row.quantity,
    cardName: row.card_name,
    cardNumber: row.card_number,
    setId: row.set_id,
    setName: row.set_name,
    imageBase: row.image_url,
    updatedAt: row.updated_at,
  };
}

export function toError(error: PostgrestError): OwnedCardsError {
  if (error.code === '23514') return new OwnedCardsError('quantity-limit', { cause: error });
  if (error.code === '42501' || error.code === 'PGRST301') {
    return new OwnedCardsError('unauthenticated', { cause: error });
  }
  if (!error.code && /fetch|network/i.test(error.message)) {
    return new OwnedCardsError('network', { cause: error });
  }
  return new OwnedCardsError('unknown', { cause: error });
}

import { Injectable, inject } from '@angular/core';
import { PostgrestError } from '@supabase/supabase-js';
import { SUPABASE } from '../core/supabase/supabase.client';
import { Finish } from '../catalog/card.model';
import {
  AddOwnedCardInput,
  CardLanguage,
  Condition,
  MAX_QUANTITY,
  OwnedCard,
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
const LIST_LIMIT = 1000; // paging arrives with browse/filter (M5)

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

  async list(): Promise<OwnedCard[]> {
    const { data, error } = await this.supabase
      .from('owned_cards')
      .select(COLUMNS)
      .order('updated_at', { ascending: false })
      .limit(LIST_LIMIT);
    if (error) throw toError(error);
    return (data as Row[]).map(fromRow);
  }
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

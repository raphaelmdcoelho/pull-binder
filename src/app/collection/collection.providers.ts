import { Provider } from '@angular/core';
import { SupabaseOwnedCardsRepository } from './supabase-owned-cards.repository';
import { OwnedCardsRepository } from './owned-cards.repository';

/** Wires the Collection port to Supabase. */
export function provideCollection(): Provider[] {
  return [{ provide: OwnedCardsRepository, useClass: SupabaseOwnedCardsRepository }];
}

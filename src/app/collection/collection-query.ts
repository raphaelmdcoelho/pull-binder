import { CollectionQuery, CollectionSummary, OwnedCard } from './owned-card.model';

/**
 * Applies a Collection query to cards already in memory. The server does this for real; this
 * stand-in serves the offline snapshot, so it follows the same rules: a case-insensitive "contains"
 * on the name, exact matches on the other filters, and the same sort orders (ties end in `id`).
 */
export function applyCollectionQuery(
  cards: readonly OwnedCard[],
  query: CollectionQuery,
): OwnedCard[] {
  const text = query.text.trim().toLowerCase();
  const matching = cards.filter(
    (card) =>
      (!text || card.cardName.toLowerCase().includes(text)) &&
      (!query.setId || card.setId === query.setId) &&
      (!query.condition || card.condition === query.condition) &&
      (!query.language || card.language === query.language) &&
      (!query.finish || card.finish === query.finish),
  );
  return matching.sort(comparator(query.sort));
}

function comparator(sort: CollectionQuery['sort']) {
  const byName = (a: OwnedCard, b: OwnedCard) => a.cardName.localeCompare(b.cardName);
  return (a: OwnedCard, b: OwnedCard): number => {
    switch (sort) {
      case 'name':
        return byName(a, b) || a.id.localeCompare(b.id);
      case 'set':
        return a.setName.localeCompare(b.setName) || byName(a, b) || a.id.localeCompare(b.id);
      case 'quantity':
        return b.quantity - a.quantity || byName(a, b) || a.id.localeCompare(b.id);
      default:
        return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
    }
  };
}

export function summarizeCards(cards: readonly OwnedCard[]): CollectionSummary {
  return { entries: cards.length, copies: cards.reduce((sum, c) => sum + c.quantity, 0) };
}

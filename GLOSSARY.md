# Pull Binder

An app for people to manage their physical Pokémon TCG cards.

## Language

**Card**:
A printed Pokémon TCG card as listed in the catalog (e.g. "Charizard, Base Set 4/102"). Shared by every user and never edited by them.
_Avoid_: Printing, listing, catalog entry

**Catalog**:
The external, read-only reference of all Cards, with their names, sets, images and the finishes each one exists in.
_Avoid_: Database, card list

**Owned card**:
A record that a user holds one or more physical copies of a Card in the same condition, language and finish. Identical copies are merged into one Owned card with a quantity; a copy that differs becomes its own Owned card.
_Avoid_: Copy, item, entry, my card

**Collection**:
All of one user's Owned cards. It is private to that user.
_Avoid_: Inventory, library, portfolio

**Condition**:
The physical state of an Owned card, one of Near Mint, Lightly Played, Moderately Played, Heavily Played or Damaged. Professional grading is not a Condition.
_Avoid_: Grade, quality, state

**Finish**:
The surface treatment of an Owned card (normal, holo, reverse holo, or other). The Catalog decides which Finishes exist for a given Card.
_Avoid_: Variant, foil, rarity

**Language**:
The language printed on an Owned card. It is separate from the language of the app's interface.
_Avoid_: Locale, region

**Binder**:
A user's physical binder, made of pages and slots, that holds some of their Owned cards. Planned after the first release.
_Avoid_: Folder, album, deck

**Wishlist**:
The Cards a user wants but does not own. Planned after the first release.
_Avoid_: Want list, favourites

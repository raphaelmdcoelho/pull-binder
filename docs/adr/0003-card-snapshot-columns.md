# 0003 Catalog snapshot on owned cards

Status: accepted (2026-10-18)

## Decision

`owned_cards` stores `card_id` plus a small copy of Catalog data (name, number, set id and name, image URL). The copy is a cache: it is never edited by the user and is refreshed whenever the Card is fetched again.

## Why

It lets the Collection be filtered and sorted in SQL and shown offline without one Catalog call per Card. Cost: a few redundant columns that can go stale.

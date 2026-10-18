# 0002 Catalog behind an adapter

Status: accepted (2026-10-18)

## Decision

Features depend on an abstract `CatalogService` (search cards, get a Card, list sets), never on the TCGdex SDK. The TCGdex implementation is the only code that knows its URLs and field names. Card images are hotlinked, never re-hosted.

## Why

TCGdex publishes no rate limits or SLA and its image terms are unstated. An adapter lets us add caching, swap the source or self-host it without touching features.

# Proposed Reddit integration

Status: design only; no Reddit API collection is implemented. Access approval is pending.

Purpose: surface timely, unverified Canadian retailer availability leads for a personal, non-commercial local stock tracker, with source links. The app does not represent or moderate any subreddit.

## Requested communities

- r/GamePreordersCanada
- r/NintendoCanada
- r/VideoGameDealsCanada
- r/Switch2
- r/Switch
- r/EBGames
- r/NintendoSwitch
- r/NintendoSwitch2
- r/Zelda

Prioritize the three Canadian communities. Filter broader communities narrowly for Zelda anniversary consoles/controllers and Canadian retailer or location indicators. Clearly non-Canadian reports are excluded; ambiguous locations remain unknown.

## Proposed processing

Use approved, read-only access to recent public posts and comments in relevant threads. Incremental polling around five-minute intervals would be bounded by Reddit-approved aggregate request limits, caching and backoff. This does not require continuously scanning every comment in broad communities.

Rules based on product, retailer, place and availability terms would extract item/version, store/location, online versus in-store context, claimed quantity and source timestamps. Group related reports, avoid counting repeated hearsay as independent evidence, and distinguish report time from alleged sighting time. Claims remain unverified and do not change verified retailer stock.

Display a short lead with an original Reddit permalink in the private local dashboard. Optional SMS to the owner would identify the report as unverified and link to the source.

## Proposed access and retention limits

- No automated posting, commenting, voting, private messaging or private-data access.
- No user profiling, identity matching, sale of data or AI training.
- No bulk historical collection or public redistribution service.
- Proposed rolling 48-hour cache of only relevant content, IDs, timestamps and permalinks; remove deleted content when detected and follow any stricter Reddit-approved requirements.

Implementation and actual retention/access limits will depend on Reddit's decision. This document is a proposal, not a claim that API approval has been granted.

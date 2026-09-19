## Learned User Preferences
- Prefer a mobile-first web demo; mock routes and local parse are acceptable when live Google Maps or LLM APIs are unavailable.
- Keep code simple and direct: no weird wiring or needless abstractions.
- Include tests from shallow to deep, and split them across files instead of one catch-all test file.
- Write comments and non-code prose in Traditional Chinese following ASD-STE100; keep identifiers, APIs, and required technical terms in English.
- Rider-facing UI copy is fully English.
- Matching may show this rider’s own agent conversation theater in English; hide LLM/structure output, other agents’ talk, others’ fares, structured fields, and the unmatched carpool pool.
- Riders do not bargain, vote, or pick surplus axes; they set walls before matching and wait for a result.
- Keep Max-walk sliders and circles at both pickup and dropoff so agents can trade walk; do not switch to door-to-door pickup (that becomes ordinary carpool and removes walk walls).
- Start with pickup/dropoff only (no map). After confirm, show this rider’s own route plus preferences and Max-walk circles at both ends; other riders appear only after origin and destination are set.
- Address search should follow Google Maps place picking; suggestion lists overlay the map, and map overlay cards keep a fixed size on zoom and should not cover the route.
- Keep API keys in local `web/.env` only; never write them into plan markdown or source.

## Learned Workspace Facts
- The demo app lives in `web/` (Vite, React, Leaflet) as a rider flow: login → demand → parse → routes → negotiate → pay → track.
- Optional `OPENROUTER_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` go in `web/.env` (see `web/.env.example`); missing keys fall back to local parse and mock or local place search. Agent/arbiter prompts live in `web/src/engine/prompts.ts`. OpenRouter may rewrite this rider’s English theater only and must not decide the deal.
- Demo login is username-only (no password) via per-tab `sessionStorage`. SQLite `storage/users.sqlite` stores `id` + `username` and seeds Yu, Chiang, Lin, Yang; unknown names fail. Default pickup/dropoff sit on a Hsinchu corridor so default walk circles can intersect.
- Live match state is `storage/matches/current.json`. One rider stays collecting (`Waiting for nearby riders`); 2–4 riders whose pickup circles share an intersection and dropoff circles share an intersection run `runMatch`; a join after settled starts a new group. Empty intersection at either end rejects the join (`walk_circles_miss`) and keeps the group collecting; do not fall back to door-to-door stops.
- Pre-match Your route is this rider’s pickup→dropoff driving path, ETA, and Max-walk circles only: blue pickup, orange dropoff, blue road polyline (not a straight line). After a share match, each Pay/Track window shows this rider’s corridor slice only: gray walk-start door (circle) and gray walk-end door (square), blue dashed walks, own blue-circle board and orange-square alight on the spine, and numbered peer stops in between (cool-blue pickup circles, warm-orange dropoff squares). Other riders’ doors and stops before this rider boards or after this rider alights are hidden. The shared two-meet yellow `pin-via` path is not used. Join order does not set the taxi path.
- Extra delay is max extra shared-ride minutes versus a solo trip, not a clock arrive-by time.
- The fare/taxi card on Pay shows match conclusion, rider count, and plan on the left, and only this user’s match `finalFare` on the right. Track Your fare uses the same `payView.fare` / own `finalFare`; if match is not ready it keeps current `youFare`.
- Match soloFare and share split use the Hsinchu taxi meter (flag NT$100 / 1.25 km, then NT$5 per 200 m; delay NT$5 per 80 s when duration exceeds cruise). Pay and Track still read own finalFare.
- Locked matching protocol: 2–4 user agents plus 1 arbiter. Demand → structured packs → arbiter v1 → each agent scores and sends one surplus pitch → arbiter v2 → rescore. Wall-kick then silent recompute (not a third discussion). Majority of remaining riders with v2 score > v1 adopt v2 (2 riders need 2 votes, 3 need 2, 4 need 3); else keep v1. Theater is a translation of pitch and score, not the deal. Rider sees only own agent English theater plus own walk/ride/fare.
- Walls are walk, extra time, vehicle/luggage/accessibility, and fare must beat solo. A kicked rider pays solo; remaining riders split the new meter by solo-fare ratio and re-check walls. If one rider remains, dissolve the group and all pay solo.
- Product brief/plan assets live in `HackMeiChuPlan`. The locked multi-window match plan is `docs/superpowers/plans/2026-09-19-multi-window-match.md`.

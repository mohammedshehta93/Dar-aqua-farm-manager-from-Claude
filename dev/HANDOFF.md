# Farm Manager — developer handoff

Single-file web app for aquaculture farms (RAS, aquaponics, ponds). Multi-farm SaaS:
a platform owner creates farms + licences; each farm's data is isolated by Supabase RLS.
**Live:** https://mohammedshehta93.github.io/Dar-aqua-farm-manager-from-Claude/
**Language with the owner:** Egyptian Arabic, short and direct; explain trade-offs honestly; test before claiming.

## Stack
- `index.html` (~760 KB): all HTML/CSS/JS inline. GitHub Pages hosting. IndexedDB (local) + Supabase (auth, data, RLS).
- Supabase project `mjtxibdxqxrgykuyftsr` — only the **publishable** key is in the app (public by design).
- AI: Cloudflare Worker `farm-ai-2.mohammedshehta86.workers.dev` (`dev/ai-worker.js`): Workers AI **binding** (no API token),
  accepts only the app origin + a valid Supabase session; tries a list of models, `MODEL` env var overrides.
- No secrets anywhere in the repo or app. A deploy token is given by the owner in chat (repo-scoped, Contents R/W, expires 2027-10-26).

## How the code is extended (important)
- New features are written as a JS module and merged with `node dev/tools/merge_module.js module.js index.html`
  (inserts before `// ── Init ──`, removes older duplicate top-level function declarations — **last definition wins**).
- Wrappers pattern for existing functions: `var _core = fn; fn = function(){ ... _core.apply(this, arguments) ... }`.
- Small edits: exact-string replacements that assert exactly one match (fail loudly otherwise).
- After every change: `node --check` on the extracted main script + run the test suites.
- ⚠️ The merge tool de-duplicates **function declarations only**. Wrapper blocks (`var _x = fn; fn = function…`) are NOT
  de-duplicated: merging the same module twice stacks them (→ infinite recursion). Always merge onto a clean `index.html`
  (`git checkout index.html` first) and watch for `replaced: <name>` — it means you overwrote an existing app function.
- ⚠️ `VIEWS = {daily: renderDaily, …}` captures render functions **by reference**: reassigning `renderDaily` later has no
  effect on `show('daily')`. Patch the render source with exact edits, or also update `VIEWS[...]`.

## Key concepts / modules (search these names)
- Tenancy: `resolveAccess`, `daEnsureTenant`, `daWipeLocalTenant`, `TENANT_KEY`, platform: `renderPlatform`, `platform_*` RPCs.
- Units (tanks) live in Supabase `farm_units`, cached in IDB; `RAW` array is filled at runtime (no farm data in code).
  Layout builder (`daLayoutBuild`), site systems (`daSites`: aquaponics/ras/...), unit editor/rename (`daOpenUnitEditor`, `daRenameUnit`).
- Live state: `_txLiveRows` replays transactions **by date** (`daTxOrder`), memoized by `_dataVer`; per-unit index `daTxByUnit()`.
- Timeline consistency for back-dated entries: `daSimulateUnit`, `daTimelineCheck`, `validateTX` (blocks emptying a tank before later records, over-removal, entries before stocking/opening balance).
- AquaManager "Site Overview" import with opening balances (`u.open`): `daParseAquaManager`; Excel template import/export: `daParseImport`, `daExportBackup`.
- Sync: server-stamped `transactions.synced_at` → incremental `loadTXFromSB`, `daRealtimePull` (30 s), weekly id reconcile `daMaybeReconcile`,
  tombstone deletes (`deleteTX` uploads `{deleted:true}`; `_txDead`), offline queue `syncOfflineQueue` (batch, keeps failures).
- Farm settings shared via `farm_settings` (localStorage keys in `DA_SYNC_PREFIXES` auto-push).
- Feeding: weekly grid `renderFeedWeek` (paste from Excel, real dates), printable sheet `renderFeedingPrint` (meals by temperature, A4 pages).
- RAS: per-filter loops `daRasLoops`, capacity fixed in TAN from proven max feed × protein (or media), protein per pellet size, max feed & max biomass per section.
- Mortality causes: optional, one farm-wide list `daCauseList()` (synced key `daracqua_settings_v2_mortcauses`, edited in
  Settings → المعايير). New entries store the Arabic label; legacy keys (disease…) mapped by `daCauseLabel`. Wiring = `dev/tools/patch_mort_causes.py`.
- Harvest-soon alert: `daHarvestSoon/daHarvestSoonAlerts` (module `dev/modules/mort_causes_harvest.js`): per section, ≤14 days,
  skips brood/quarantine, SGR from samples ≥7 days apart, projected from the last sample date; per-farm `harvestTargetWt` → global. Shown in `smart`.
- FCR by stage (`fcr-stage`, module `dev/modules/fcr_weekly.js`): `daUnitPeriods` → periods between weight observations per tank;
  gain credits dead fish (bio FCR) / not (economic); stage = mid-weight in the feed-size bands; totals Σfeed/Σgain; `daPeriodIssue`
  excludes periods with no/partial feed (<60% of days). Expected FCR per stage: synced key `daracqua_plan_v1_fcr`. Alert `daFcrAlerts` (>125% over 28 d).
- Weekly report (`weekly-report`): `daWeeklyData/daWeeklyText`, live (late entries update it), feed completeness %, week end day in synced
  `daracqua_plan_v1_weekend` (default Saturday). Dashboard card until opened (`daracqua_wr_seen`, per device).
- Menu: "التنبيهات الذكية" now opens `smart` (all alerts); `alarms` (density only) listed separately.
- Pilot kit (module `dev/modules/pilot_kit.js`, edits `dev/tools/patch_pilot_kit.py`): `help` (guide, tab per role, every
  menu path in it is checked against `DA_NAV` by `e2e_pilot`) and `legal` (privacy + terms, public, linked from login).
  **Fill `DA_LEGAL` (operator, contact, dataRegion) before inviting a pilot farm**; keep the pages true when features change.
  AI advisor prompt now uses `daFarmName()` / settings species & location (was hard-coded to one farm).
- Error logging: `daLogError` → `client_errors`; platform page shows grouped errors. Dates are local (`daToday`, `daYmd`).
- Navigation: top tabs `DA_NAV` (8 groups, permission-aware via `canAccessView`); old sidebar kept hidden in DOM (tests use it).

## SQL (in `dev/sql`, all idempotent) — ✅ all four have been run on the live database (confirmed by the owner)
`multi_farm_setup.sql` (tenancy + RLS + platform RPCs) · `delete_user.sql` · `error_logging.sql` · `sync_timestamps.sql` (synced_at + trigger).
The app degrades gracefully if a later one is missing (e.g. full download without `synced_at`).
⏳ `error_retention.sql` (2026-10-28, trigger deleting error reports >90 days — the privacy page promises this) — **not yet run**.
Until it is, the platform page prunes once a day when opened.

## Tests (Playwright + mock Supabase with RLS-like rules)
```
pip install playwright --break-system-packages && python -m playwright install chromium
mkdir -p /tmp/jstools && cd /tmp/jstools && npm install acorn xlsx@0.18.5
APP_ROOT=<folder containing index.html> python3 dev/tests/e2e_auth.py      # each suite prints "N/N passed"
```
20 suites, ~350 checks. `e2e_aqm, e2e_edit, e2e_loops, e2e_ras3, e2e_week, e2e_backdate` need the owner's AquaManager
export at `/mnt/user-data/uploads/2510.xls` (not in the repo — farm data). Every suite also reports app-side errors (must be 0).

## Deploy
Edit `index.html` → run tests → commit → push to `main` with the owner's token (never store it in the repo/app) →
GitHub Pages updates in ~1–2 min; open apps show a "new version" banner.

## Next (owner's priority order)
1. ✅ Done (2026-10-28): optional mortality causes + harvest-soon alert (`e2e_mortharv`).
2. ✅ Done (2026-10-28): FCR per stage + weekly report (`e2e_fcr`).
3. ✅ Done (2026-10-28): user guide + terms & privacy (`e2e_pilot`). Needs `DA_LEGAL` values + legal review.

## Known open points
Supabase plan (free tier pauses, no daily backups) · iOS Safari may evict local storage (install to home screen) ·
last-write-wins on simultaneous edits and on the shared settings blob · photo AI entry disabled · SFR/growth tables are tilapia defaults.

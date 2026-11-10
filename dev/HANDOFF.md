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
  Supabase region (owner, 2026-10-28): Northeast Asia (Tokyo) ap-northeast-1, Free plan, Nano, no backups. Region can't change without a new project.
  Owner decision: legal name/e-mail + lawyer review deferred until the first external pilot farm; backups first.
  AI advisor prompt now uses `daFarmName()` / settings species & location (was hard-coded to one farm).
- Tabs (module `dev/modules/tabs.js`, edits `dev/tools/patch_tabs.py`), AquaManager-style: one tab per page, each tab
  owns a pane; only the active pane is attached to `#content` (hidden panes detached → no duplicate ids). Typing in a data
  field marks the tab dirty (●); a real save (`_dataVer` changed by add/update/deleteTX, or applySettings) clears it.
  Dirty tabs: kept when re-opened from the menu, never wiped by background re-renders (`daBgRefresh` replaced the
  auto-refresh/sync/realtime `show(currentView…)` calls — realtime used to wipe a half-filled weekly feed grid), confirm on
  close / logout / leaving the site. Max 10 tabs (LRU, dirty never dropped). Logout/tenant switch clears all tabs.
  Unsaved input is in memory only: a page reload or the phone killing the browser loses it.
- Daily feed sheet (`feed-sheet`, module `dev/modules/feed_sheet.js`): the paper Feed Log (AQU-FR-25-01-07) on screen,
  LTR like the paper. Meal times per section group per farm in synced `daracqua_plan_v1_sheets` (owner enters them in the
  page; the farm layout is NOT in the public repo). One feeding record per tank/day id `fs-<unit>-<date>` (kg = Σ meals,
  `meals` breakdown, `size`, `feed` = inventory product chosen per pellet size in the header) + mortality `fsm-<unit>-<date>`.
  Saving again edits (history kept); asks before double counting with other screens; never touches mortality without permission.
  Next: the printable sheets with digit boxes + on-device photo reading (no external AI; kg like 2.5, size 1/2/3 mm).
- Daily testing log (`wq-sheet`, module `dev/modules/wq_sheet.js`, edits `dev/tools/patch_wq_sheet.py`) — owner chose ONE
  reading per SECTION: water_quality record with unit = section id ("F2.S01"), scope:'section', id ws-<section>-<date>.
  ✓/✗ computed from per-farm limits (getSettings(farm): tempLo/tempHi/phMin/phMax/doCrit, edited in the page). WQ alerts
  now use each reading's farm limits (were: pH hard-coded 6.5–9, no low temp, one farm's settings for all). Trends page
  shows the section's readings for each tank. Out of range without corrective action → confirm.
- FEEDING FROM ONE SCREEN ONLY (owner, 2026-10-29; module `dev/modules/feed_single.js`): quick-feed, tx-feeding,
  feed-week, photo-entry removed from the menu (opening them shows a pointer to the sheet), the daily sheet lost its feed
  tab, addTX refuses feeding unless source 'sheet' / 'import' (or _skipValidation). Old records stay valid; the sheet's
  yellow warning has "📥 انقلها للشيت" (engineer+) → one fs- record per tank (meal kept if it matches a sheet meal, else
  first meal), originals deleted. `window.DA_SINGLE_FEED=false` = legacy mode, used ONLY by e2e_tabs/e2e_week that test
  the retired screens' code. Tests that check validation via addTX send feeding with source:'sheet'.
  Next asked by owner: photo entry as an option INSIDE the feed / water / sampling sheets (not a separate tab).
- Register forms like AquaManager's detail windows (owner 2026-11-01): harvest by SIZE categories (synced
  `daracqua_plan_v1_sizes`, default owner's: صغير <450, طبيعي 450–550, كبير 550–750, كبير جداً ≥750;
  editable on the page) with fish / kg / invoiced kg / price → avg, %, sale value; avg outside its size range shown red.
  Options on both forms: Is Sampling (harvest default ON, transfer OFF) → a sampling record; Close Unit → remainder as
  adjustment (source 'close'); Adjustments + type. Every companion record carries `link` = harvest id / transfer txGroup
  and is deleted/replaced with it (`daLinked`). Transfer destinations show Fish/Av.Wt before → New fish / New Av.Wt
  (weighted), ⚠️ when the incoming size differs > 30 %.
- HARVEST & TRANSFER REGISTERS (module `records.js`, test `e2e_records`): VIEWS tx-harvesting / tx-transfer = registers:
  From/To (default last 30 days; saving a record dated before From widens it — on the 1st of a month a back-dated record
  "vanished"), filter, totals, Excel, right-click / ⋮ menu (new, edit, copy, delete; edit/delete engineer+). Transfer = one
  txGroup: 1 transfer_out + N transfer_in, destinations carry the source cycle's batch (LTD continuity). Harvest: avg wt
  computed, optional `adjustment` saved alongside (source 'harvest'). Never more out than `daRegFishAt` (fish that day,
  excluding the record being edited). Generic `daCtxMenu(ev, items)` for right-click menus.
- Site Overview header right-click menu (`daOvMenu`, test `e2e_ovmenu`): sort asc/desc, clear sort (natural tank order),
  hide column, column chooser; hidden columns per device in `daov_hidden_cols` (not synced); Unit always shown.
- DAILY OVERVIEW FROM RECORDS (module `daily_am.js`, test `e2e_daily`): the old page showed frozen snapshots taken when
  the app was opened (late entries never reached them; unopened days missing). Now each day is computed: end-of-day stock
  (`daUnitEndSeries`, one replay per tank), that day's feed / dead / harvest, and how many stocked tanks have feed entered.
  Totals equal the Site Overview for the same date. VIEWS['all-units'] (legacy alias) → dated Site Overview too.
- SITE OVERVIEW IS DATED, AquaManager style (owner: no new pages; module `overview_am.js`): VIEWS['site-overview'] =
  renderOverviewAM (old renderSiteOverview kept, unused). Date → tanks with fish THAT day (end of day, `daStateEnd`),
  AquaManager columns; UTD = tank's cycle up to the date, LTD = same batch name across tanks; green ≥ harvest weight,
  yellow ≥ 75 %; sort, filter, totals; click a row → its cycles card (close cycle). `tank-cycles` page removed from the menu
  (view redirects). Imported cycles start at the AquaManager unit start date/weight and carry the imported totals
  (raw.open.feed/mort/gain) — e2e_aqm A12 checks a real imported tank equals AquaManager (feed 89.6, FCR 1.51).
- TANK CYCLES + FARM ON ANY DATE (module `cycles.js`, edit `dev/tools/patch_cycles.py`, test `e2e_cycles`): cycles are
  DERIVED (no input): open when an empty tank gets fish (stocking / transfer in / opening balance), close at 0 fish; a day
  that empties AND restocks closes the old cycle first. Page `tank-cycles`: state of every tank on a chosen date (daStateAt)
  + per-tank cycle history (days, start/end, feed, dead, adjustment, out kg, economic FCR). New record type `adjustment`
  (count) = "close cycle" for a count difference — NOT mortality; added to DA_SUB_FIELD/DA_TX_PHASE (date engine) AND
  _txLiveRows (live engine, hard-codes types). Note: daStateAt on the event day itself = start-of-day state (by design).
- Plan/twin corrections (owner 2026-10-31): free-text stage editor let a paste land on an old line → stage "1–∞" swallowed
  every tank (97 instead of 42). Now a form + `daPlanStageIssues` refuses overlaps, '=' in names, missing/non-increasing
  transfer weights; per-stage minimum tank volume (grow-out = 21 concrete tanks: min 100 m³). Default TGC 1.8 gave
  50→450 g in 79 days (owner: wrong) → TGC order: samples → the farm's KNOWN CYCLE (cycFrom/cycTo/cycDays, twin settings,
  also on the plan page) → default 1.1; source shown everywhere. Expected survival % for the plan (no mortality on record
  showed 100% survival).
- FARM PLAN, OPTIONAL (owner: "متعملش حاجه اجبارى"; module `plan.js`, test `e2e_plan` vs Python): stages per farm (F2:
  "1-3 = تحضين | 50 / 4-5 = وسط | 150 / 6- = تسمين"), batches (date, count, start g, harvest g) simulated with the twin's
  farm TGC / temperature / mortality → transfer + harvest dates, harvest kg, stage occupancy vs capacity (volume × density
  warning), weekly feed by pellet size; goal mode (kg/month → fish to stock per month, one-click add). Plan vs actual is
  automatic: stocking records match by batch name, else date ±7 d. Advisory alerts only (info/warn). Never blocks entries.
  Synced key `daracqua_plan_v1_farmplan`; daPlanRun cached by _dataVer.
- Keyboard in entry tables (module `grid_keys.js`, test `e2e_keys`): ↑/↓/Enter (Shift+Enter up) = same column across rows
  and across a sheet's group tables, skipping locked rows; ←/→ = neighbour cell in the table's visual direction (caret moves
  first while editing text); arrows never step number inputs; reached cell is selected. Works for every td input.
- DIGITAL TWIN phase 1 (`twin`, module `dev/modules/twin.js`, test `e2e_twin` checks the math against Python): per tank
  TGC from its own samples (≥7 d apart) × its section's measured temperature (fallback section → farm median → setting),
  mortality = section last-28-day rate, feed = getSFRAdjusted table; per section TAN = feed × protein(size band) × 0.092,
  O₂ = feed × kg/kg, filter load % = TAN ÷ TAN at the PROVEN feed (setting, raised automatically by weekly NH₃ readings
  ≤ limit using the section's mean feed of the 7 days BEFORE the reading). Scenarios: feed %, ±°C, horizon; assumption:
  feed above table adds no growth, below scales growth. Backtest = predict 3rd sample from 1st→2nd. Weekly NH₃/NO₂ entry
  on the page (water_quality, unit = section, id wn-<sec>-<date>). Settings in synced `daracqua_plan_v1_twin` per farm.
  One-pass index (`daTwinIdx`, cached by _dataVer) — never rescan getTX() inside loops. Next (phase 2): predict TAN/NO₂
  concentration (needs flow per section + water exchange %).
- Photo-readable revision of the farm's OWN Word forms (owner chose "Rev جديد"): `dev/forms/build_wq_form.py` adds corner
  marks, digit boxes, date boxes to the farm's original FH1 Daily Testing Log .docx (original not in the repo). Draft sent
  for review 2026-10-31; reader NOT yet bound to it (measure box positions from the rendered PDF when approved).
- ALL FARMS IN ONE AQUAMANAGER COPY (owner 2026-11-09: AquaManager keeps the whole site in one Feeding / Mortality screen;
  aqm_export.js): daAqxFarms = farms whose tank names were learned (others e.g. the nursery F3: "not in AquaManager — not
  copied"); daAqxAll / daAqxMortAll concatenate every such farm; panel shows each farm (tanks · kg · dead, amber when its
  feed is not saved) and asks before copying when a farm is missing; store / feed names per farm in one table; files
  AquaManager_Feeding_<date>.xlsx; copy log key "ALL|date|kind". Testing copy: farms with no learned names are noted
  (not copied, no "name missing" warning). e2e_aqx X11–X13, e2e_aqw W3h.
  LESSON: removing a module's LAST function by hand also cut the next module's header vars (DA_AQW_*) → new
  `dev/tools/verify_modules.py index.html` checks every module function / var / wrapper block is in the app — RUN IT
  BEFORE EVERY PUSH.
- LANGUAGE SPEED (owner 2026-11-09 "very slow on the phone, especially choosing the language"; benchmark
  `dev/tests/perf_lang.py`, 4× CPU): switching to English took 110 s. Causes: daEnNode walked the page's own <script>
  text (1.3 MB) and one rule "(\S+) يومها فيه …" backtracked catastrophically on it. Now daEnNode / the Urdu walker skip
  SCRIPT / STYLE / TEXTAREA / NOSCRIPT; rules run only when their fixed words are in the text (daRuleKey); open-ended
  \S+ pieces bounded ([^\s]{1,40}); phrase patterns built once (_daEnPhraseRe / _daUrKeyRe); results memoised
  (_daEnMemo / _daUrMemo, reset at 5000). Switch now ≈ 0.15 s at phone speed.
- INSTALL AS AN APP (module `install_app.js`, test `e2e_install`): sw.js is now REGISTERED — with NO fetch handler (a
  pass-through handler made Playwright mocks miss requests and adds latency for nothing); it only clears old caches.
  beforeinstallprompt → "📲 install" button (login card #inst-login, worker bar #inst-bar) opens the phone's prompt; else
  (iPhone / no prompt) a bottom sheet with 3 steps; texts per language in DA_INST_T (not translated afterwards: <b>
  splits sentences); hidden in standalone mode.
- AQUAMANAGER IMPORT = TODAY'S PICTURE (module `aqm_replace.js`, test `e2e_aqmreplace` on 2510.xls + a "today" copy
  without 3 tanks and one at 0 fish): tanks of the file's farms that are not in it (or with 0 fish) and have fish in the
  tool get an opening balance of 0 at the file's date (open:{fish:0 …}); preview lists them with a tick box (on by
  default); farms not in the file untouched; nothing deleted. daParseAquaManager now also returns emptyNames.
- FCR ONLY FROM REAL GAIN (owner 2026-11-09: Site Overview showed FCR 317,901,150,167,329 for nursery tanks stocked that
  day with one dead; module `fcr_safe.js`, test `e2e_fcrsafe`): daFcrSafe(feed, gain, base) = null unless gain ≥ max(0.1 kg,
  1 % of starting biomass), and null above 50 — used in daAllocAt (fcr/lfcr), daUnitCycles (efcr), daCycleTo + batch lot
  (overview_am), daUnitPeriods + daFcrSum (fcr_weekly), sampling sheet. Site Overview totals row = Σfeed ÷ Σgain ("FCR=")
  per UTD and LTD (rows now carry lfeed), not the mean of tank ratios. e2e_aqm (real AquaManager file) unchanged.
  Also found two daCopyText (fcr_weekly + username_login; the first called the removed daCopyFallback) → one helper in
  username_login.js with a hidden-textarea fallback; no function is defined in two modules any more.
- URDU FOR WORKERS (owner 2026-11-09; module `i18n_ur.js`, test `e2e_urdu`): workers and the login page get a 3-way language
  menu (عربي · English · اردو) from #lang-btn; office users keep the Arabic / English toggle (a stored "ur" reads as "en"
  for them). Urdu = the English rendering (isAr false) + English → Urdu (DA_UR exact phrases, DA_UR_KEYS ≥ 4 chars at word
  boundaries, DA_UR_RULES for messages with numbers), dir rtl, Urdu day / month names in daFmtDate and the calendar,
  worker guide in Urdu. daUrText skips any text that already has Urdu-only letters (DA_UR_DONE) — without it,
  translations that keep a Latin symbol ("DO (mg/L)" → "آکسیجن DO (mg/L)") looped forever. toggleLang(true) = the app
  switching itself (start-up), toggleLang() = the button (menu); the choice is stored AFTER the switch (the English
  layer's wrapper writes ar / en). New worker-visible text: add English (DA_EN) AND Urdu (DA_UR).
- SECTIONS LAYOUT (owner 2026-11-09: the nursery's 7 tanks are 7 sections but were added as one; Settings showed "no tanks";
  module `tank_layout.js` + tank_add.js, test `e2e_tanklayout`). Add card asks "ترتيب التانكات": all in one section /
  each tank its own section (names F3.S01T01 … F3.S07T01, section per name). "🔀 ترتيب" per farm in the status card:
  one section · each tank its own · N per section → plan old → new shown, ONE confirm, daRenameUnit through temporary
  names (no clashes; records move with the tank), old + temporary names queued for cloud deletion, units re-uploaded.
  Settings → Tanks: card #st-tanks lists every farm's real tanks by section (+ add / manage buttons); the old Settings
  list is hidden when empty, else titled as old with its add button hidden. 2026-11-09: owner saw a leftover
  "F3.TMP<ms>_3" tank after rearranging (not reproduced locally; likely the shared upload queue across browser tabs or a
  sync landing mid-rename). Closed every way back: localStorage lock daracqua_units_busy (90 s, all tabs) during
  daLayApply — pulls and flushes skip; temporary names (DA_TMP_RE) are never uploaded from the queue; daRenameUnit wrapper
  drops the old name from the upload queue and queues it for deletion; daTmpCleanup after every pull deletes temporary
  tanks with no records everywhere (fixes the owner's leftover by itself).
- DAILY ENTRY STATUS (owner 2026-11-09; module `entry_status.js`, test `e2e_entrystatus`): view 'entry-status' (Home menu,
  perm approve_data — the supervisors; workers with view_dashboard must NOT see it, e2e_nav N3). Per farm for a day
  (daEsFarm): feed = stocked tanks (daFsRows fish > 0) with a feeding record that day (fasted X counts) + missing labels +
  "open the feed sheet" (window._fs {farm, date}); mortality total; daily testing = daWqSections with temp/pH/DO that
  day + missing; weekly = sections with a weekly reading in the last 7 days; who (byName); pending reviews. Colours
  green / amber / red (past day, or today after DA_ES_CUTOFF = 16 h) / grey. Dashboard strip #es-strip lists what is
  missing today. es-date uses the app's date control.
- TANKS REACH THE CLOUD · DELETED EVERYWHERE (owner 2026-11-09: nursery tanks re-added, still "no tanks" on the phone;
  module `units_sync.js`, test `e2e_unitsync`). ROOT CAUSES: saveUnitsToCloud returned SILENTLY when !sbReady and a
  failed upload was never retried; the next daPullUnitsIfChanged then replaced RAW with the cloud list (tanks vanished),
  or — when the device list matched at start — kept them local forever (computer yes, phones never). farmRegDelete kept
  the farm's tanks; deleting in one list left the other. NOW: saveUnitsToCloud queues every unit (with its data) in
  localStorage daracqua_units_pending BEFORE uploading, throws when not ready, clears on success; daUnitsFlush retries
  adds + queued deletes (daracqua_units_pending_del) before every pull; after a pull queued adds are put back and queued
  deletes dropped. daDeleteUnit / unitDeleteFromSetup / farmRegDelete delete from RAW + settings list + cloud (farm
  delete offers its tanks). Farm setup "📋 حالة التانكات": per farm tanks / ☁️ in the cloud (live query) / ⏳ waiting /
  ⚠️ old Settings tanks, with "⬆️ ارفع دلوقتي" (also uploads ANY tank of this device missing from the cloud) and "🔄 انقل التانكات القديمة" (moves them to RAW + cloud, same names).
  Names: daTankNo label = "s.t" for standard names (as on paper), the tank's OWN name otherwise (owner saw "1.1" for N1).
- ADDING TANKS (owner 2026-11-09 "fix it at the root"; module `tank_add.js`, test `e2e_tankadd`): there were two places
  with free-text names — Farm setup "add a unit by hand" (section optional, no empty tanks) and Settings "➕ new tank"
  (NO section → the nursery). Now ONE card "➕ Add tanks" replaces the manual card in Farm setup (DOM swap after render
  of the card holding #mu-unit): farm (or new farm code + name → registry), section REQUIRED (existing sections shown,
  next suggested), count + first tank number (next free suggested), volume, with fish (count/weight/date/batch) or
  EMPTY; names made as <farm>.S##T##, preview, existing skipped; units go to RAW + cloud like before. Settings'
  settingsAddUnitRow now opens it. Tanks without a section get a warning card with one-click "put them in section N"
  (section field set, names kept — records stay linked); daSecFix stays as a safety net.
- HATCHERY ON THE PHONE (2026-11-09): owner saw no sections on the phone, yes on the computer. Reproduced both add paths
  (setup form → farm_units cloud table; settings units → synced key): the CURRENT version delivers them to an open phone
  after 🔄 and both sheets list them → the phone was most likely an older version. 🔄 (daTabRefresh) now also runs
  daCheckUpdate so pressing it brings a newer version at once. REAL CAUSE (worker Sajed, site F3 "Nursery"): its tanks
  were added from the settings units list WITHOUT sections (names like "N1") → no section number → feed sheet "no
  tanks". daSecFix(sec, farm): a section without "S<n>" = the farm's single section "<farm>.S01" — applied in
  _txLiveRows (wrapper, custom_units.js), daRawUnit (perf_tune.js) and daUnitSecMap; daTankNo then numbers by the name's
  last number, or the order in the section. Test `e2e_nursery` (worker on a phone: feed, daily/weekly log, sampling).
- FH2 REAL PHOTOS (2026-11-09; dev/tests/data/fh2_page{1,2}_real.jpg + fh2_real_truth.json read by eye, test
  `e2e_paper_f2_real`). The farm feeds meal 1 and the last meal; X = not fed (empty tank or fish not fed) → meal {x:true},
  row fast when only X; a note written across a row (16.3 "176kg 600g 343PES") must not become feed. FINDINGS: the
  PRINTED form is a newer revision than FH2_Feed_Log docx (headers "7|11|3", "6:30|9:15|12:15|3:30", front "7:00|11:00|3:00")
  → column widths differ; photos taken at an angle (keystone). Grid now: table top edges = ends of the black header
  band measured over its thickness with ABSOLUTE darkness (g < 0.5) and gaps ≤ 2 % W; columns = every long straight
  line across the table on the RAW dark mask D2 (VM misses tilted lines), slope s0 ± 0.06; used when exactly as many as
  the form has (colsFull), else per-column search from the template. Page chosen by colFit + 1.5 × rowFit (both 0–1).
  TRUST RULE: reading trusted only if rowFit ≥ 0.6 AND colsFull; else every cell yellow + alert. FH1 real photo:
  rowFit .85, 15/15 cols → trusted (27–30/48 exact, 0 wrong unflagged). FH2 real: page detection right, 0 wrong
  unflagged, but rows drift (front rowFit .45, back .80 with 10/14 cols) → all yellow. NEXT: rows by the same "every
  long line" search (perspective), ask the owner for the CURRENT FH2 Word form (the printed revision).
- FH2 PAPER READING (owner 2026-11-08; paper_ocr.js, test `e2e_paper_f2` on SYNTHETIC photos in dev/tests/data — the
  farm's FH2 Word form filled with values via LibreOffice, rotated/blurred; truth in fh2_synthetic_truth.json).
  DA_PAPER_TPL is now {farm:{pages:[{cols, rows, headH, rowH, unit, maxV, halves:[{c0, meals, labels[], maxV?}]}]}},
  generated from the Word forms (labels = the tank numbers printed per half). FH2 page 1 = sections 1–3, 5 meals, GRAMS
  (no "12"→1.2 rule); page 2 = sections 4–5 (3 meals, max 8 kg) | 6–16 (4 meals, max 40 kg: concrete tanks eat 12 kg).
  The page is chosen by grid fit score. Grid changes that helped FH1 too (real photo 29 → 30/48): header band = first
  dark block merged with the pieces white header text splits it into; vertical lines at the angle perpendicular to the
  rows (no free angle search on faint lines). Tried and REVERTED (hurt FH1): row spacing from peak gaps, from the
  table's bottom border. SAFETY: rowFit < 0.45 (most row lines not seen) → every cell incl. empty ones yellow + alert
  "grid lines not clear". Paper fallback only when NO corner marks (an outdated print stays refused — e2e_ocr R10).
  Synthetic: page detection, tanks, units right; 0 wrong without yellow; page 2 values 124/192 right even with faint
  lines. NEEDS real FH2 photos (both pages) to calibrate.
- OLD ENTRY SCREENS REMOVED (owner agreed 2026-11-08; patch `dev/tools/patch_retire_legacy.py`): quick-feed, tx-feeding,
  feed-week, photo-entry, the old daily sheet and the old mortality form — VIEWS entries now null (the retired-notice
  wrappers show "feed is entered in one place" / the causes page), daSingleFeed() always true (window.DA_SINGLE_FEED gone).
  48 functions used ONLY by them removed (call-graph fixpoint over the whole file, script /tmp/dead_graph.js approach:
  a function goes only if every reference to it is inside removed functions) — 77 KB; index.html 1.40 → 1.32 MB.
  Tests moved to current pages: e2e_tabs (feed-sheet / wq-sheet / tx-sampling), e2e_mortharv M1–M4 (causes page),
  e2e_ai S5; e2e_week deleted (its screen is gone). 47 suites.
- SPEED + CLEAN-UP (owner 2026-11-08 "clean it and make it faster"; module `perf_tune.js`, patch `dev/tools/patch_perf.py`,
  benchmarks `dev/tests/perf_year.py` (pages, 70k local records) and `dev/tests/perf_boot.py` (a year ON THE SERVER:
  first login + daily open); PHONE=1 → CDP 4× CPU throttle). No duplicate functions existed (merge tool replaces);
  26 never-called functions removed (core + fcr_weekly/plan/paper_ocr modules). Phone-speed before → after: daily open
  4.1 → 2.1 s, first login 6.3 → 5.0 s, feed sheet 1.24 → 0.55 s, save feed sheet 2.0 → 1.0 s, sampling 1.1 → 0.3 s,
  daily overview 1.06 → 0.27 s, twin 2.1 → 1.3 s. How: generateAlerts memo (key _dataVer|day|hour|farm|lang|role);
  no alert monitor for users who cannot see alerts (workers); daRawUnit indexed (RAW + setup tanks); daBgRefresh skipped
  when the page was drawn at the same _dataVer; txStoreInit no longer rewrites the whole IndexedDB copy at every opening;
  feed-sheet helpers (daFwDefaultFeed, daFsRows, daSheetDefaultProduct) use daTxByUnit / memo instead of scanning all
  records; sampling sheet uses daTxByUnit; daFixEmptySheet returns unless a sheet is open; the worker observer no longer
  reads #content.textContent on every change. daTimelineCheck KEPT for feeding (its 'pre' / 'empty' checks apply to
  feed). Retired legacy screens (quick-feed, tx-feeding, feed-week, per-tank WQ) are still in the code, hidden; tests
  updated: e2e_fprint FP10, e2e_week W12 (workers no longer reach office / retired pages). e2e_week W1 still the known
  date-dependent failure.
- TANKS ADDED IN THE TOOL (the hatchery, owner 2026-11-08; module `custom_units.js`, test `e2e_tanknames`): two bugs
  made them invisible / locked in the feed sheet: (1) daTankNo only read "S01T01" → now also S01.T01, S1-T1, S01 T01,
  S01.Tank1, and names without T (section from the tank's setup + last number); (2) daRawUnit read the imported list
  only, so daStateAt saw a setup tank (with its fish count) as empty → now falls back to getFarmUnits (fishNo, avgWt,
  startWt, stock date, vol; flag custom:true). Wide regression clean. STILL missing for the owner → (3) daTankNo now
  works for ANY name: section from the tank's own data (daUnitSecMap = RAW + setup tanks, cached by _dataVer), number =
  last number in the name, or its place in the section; (4) the weekly log, sampling sheet and AquaManager readings
  picked a farm's tanks by NAME PREFIX ("HA.") — now by the tank's own farm (r.farm / daInFarm), like the daily log.
- SITES PER USER (owner 2026-11-08; module `sites_scope.js`, test `e2e_sites`): owner could not find the boxes at the end
  of the permissions grid → umPermsHTML now renders them in their own box "📍 المكان — يشتغل فين؟" (add + edit forms),
  and the users list shows each user's site (daSiteBadges, "كل الأماكن" when none). sites are extra items of
  getPermsList ("farm:<id>", label 📍 الموقع) → tick boxes in add/edit user, saved in profile perms (no schema change).
  daUserFarms() (null for admin / none ticked): daFarms + getFarmList filtered ("all" only when >1 site), farmFilter
  forced to the first site at login (updateUserUI), setFarm refuses others. A forced site never carries over to the next
  user on the same device; unrestricted workers (no farm picker on top) start on "all" so the sheets show their farm
  field (the feed sheet hides it when farmFilter is a farm). NEW FARMS ON PHONES: 🔄 (daTabRefresh) now also runs
  daPullSettings (custom units + farms registry are synced settings, pulled only every 4th realtime tick before), and
  after a pull that changed data an open feed / testing / sampling sheet redraws when nothing is typed or focused.
- SAMPLING SHEET + IN-APP CALENDAR (owner 2026-11-08; module `samp_sheet.js`, test `e2e_sampsheet`): VIEWS['tx-sampling']
  = one sheet per farm (tanks with fish on the day, grouped by section): last sample shown, avg g + fish weighed, change
  g / g-per-day while typing, yellow when < 97 % or > 2× last; same day edited in place (id sp-<unit>-<date>); ids
  sp-date / sp-wt-<unit> / sp-n-<unit> kept for the printed-sheet photo. Date control now opens OUR calendar (`daCalOpen`,
  month grid in the app's language, future days disabled) — the native picker follows the PHONE's language, so the
  native input is pointer-events:none. Workers: no password change on the account page (admin's job; admin reset of a
  worker's password still needs a server-side call — TODO via the Cloudflare Worker).
- WORKER PHONE SCREEN (owner 2026-11-08; module `worker_ui.js`, test `e2e_workerui`): workers get #da-wbar (big buttons
  for their pages: Feed / Water / Samples / Harvest / Transfer / Review / Guide + pinned 🔄) instead of #topnav +
  #da-tabbar (office users keep tabs; e2e_tabs T17 phone check runs as admin); header without farm picker / back; chip
  "👤 name"; connection status = dot (+ waiting count) on ≤560 px (`daCompactStatus`). Date control `daDateCtl` on
  fs-date / wqs-date / wqw-date / sp-date / rf-date: ◀ day ▶ · Today, label in the APP's language (the native date field
  follows the phone's language), tap opens the calendar. `daFixEmptySheet`: a sheet opened before the tanks arrived
  (first login on a new phone) picks a farm and redraws when daSetRAW runs. Daily-total mode hides the repeated total
  column (.fs-tot). i18n: whole phrases only — a text with Arabic left after translation stays as it was (no mixing).
- WORKER SCOPE + ENGLISH (owner 2026-11-08; modules `worker_scope.js`, `i18n_en.js`, test `e2e_workerview`):
  role worker → canAccessView only: one entry page per input permission (DA_WORKER_PAGES: feeding / mortality →
  feed-sheet, input_wq → wq-sheet, sampling, harvest → harvest+transfer, approve_data → review-queue, input_health → its
  pages), view_/manage_/export_ permissions → their pages, help/account always. homeView → feed-sheet first. Office
  buttons hidden by body.da-worker CSS (AquaManager, print, photo, entry mode, feed types). Guide: worker sees the worker
  part only (daTabs filtered), engineer worker+engineer. Worker toasts about smart alerts suppressed.
  English: phrase list + regex rules applied by a MutationObserver (text, placeholder, title) + alert/confirm when
  !isAr; worker guide written in English; language remembered (localStorage da_lang). Covers worker screens only —
  office pages may still show Arabic. Adding a worker-visible Arabic string? add it to DA_EN / DA_EN_RULES.
- PHONE + UPDATES (owner 2026-11-08; module `mobile_ui.js`, test `e2e_mobile` at 390×844): body.da-out (not logged in)
  hides farm picker / back / user chip / connection; ≤560 px header = one compact row. Updates: daShowUpdateBanner now
  reloads by itself when daUpdateSafe() (no dirty tab, empty offline queue, not typing), else banner "احفظ شغلك…" and a
  20 s retry; daStaleCheck at start (server Last-Modified newer than document.lastModified → update). Version
  (document.lastModified) on the login card and in the guide. Tests opening wa.me must route it locally (no internet →
  slow teardown).
- TESTING LOG DAILY + WEEKLY (owner 2026-11-08; module `wq_weekly.js`, test `e2e_wqweekly`): the wq-sheet has a mode
  toggle (window._wqs.mode): daily = the original sheet (temp/pH/DO); weekly = TAN · NO2 · NO3 · alkalinity per section,
  saved as wn-<sec>-<date> (same record the twin's weekly card writes and reads). The AquaManager copy of a day carries
  both (kinds no3 + alk added; alkalinity is NOT an AquaManager parameter at this farm (owner confirmed) → tool only, never warned about).
  Panel shows per farm "يومي x من y · أسبوعي z".
- WORKER USERNAMES (owner 2026-11-08; module `username_login.js`, edits `dev/tools/patch_username_login.py`, test
  `e2e_userlogin`): Supabase Auth needs an email → username "irfan" = irfan@workers.dar-aqua.app (never shown: list shows
  "👤 irfan", via text-node rewrite after adminLoadUsers). Login field "username or email"; latin [a-z0-9._-]{3,30};
  recovery blocked for them (admin changes the password). VIEWS['user-management'] re-pointed (the views table held the
  original function). REQUIRES Supabase Auth → Email → "Confirm email" OFF, otherwise signup returns no session and the
  account waits for a confirmation that can never arrive (alert explains it). Admin password reset for workers still TODO
  (needs a server-side admin call — e.g. the Cloudflare Worker with the service key, admin-checked). WhatsApp share:
  message in ENGLISH (owner). Right after creating an account a card offers "📲 ابعت على واتساب" (wa.me with link + username + password — the only
  moment the password is known) and "📋 انسخ"; 📲 next to every user in the list sends link + username only.
- TESTING LOG → AQUAMANAGER (module `aqm_wq_export.js`, test `e2e_aqw` on the owner's 588.xls): Site Measurements =
  Parameter / Site / Time / Zone / Value; the SECTION is inside the parameter name, spelled inconsistently ("Oxygen FH2. S01",
  "PH F1.S01", "TOTAL AMMONIA FH2 .S16") → `daAqwParse` + names learned per farm/section/kind (do, ph, tan, no2, no3);
  temperature is ONE per house ("Temperature FH1") → average of the sections that day, shown before copying. Date M/D/YYYY
  in the clipboard, real date in the Excel. Button "📤 للأكوامانجر" on the testing log. WHOLE SITE in one sheet (owner:
  AquaManager has every farm in one Site Measurements sheet) — `daAqwAll(date)` gathers every farm, rows in the learned
  order of AquaManager's own file (`order` = names in file order; AquaManager sorts by parameter name, houses inside);
  panel shows per farm "sections recorded of total" + its average temperature. 2026-11-09 (owner): the daily copy sends
  the WEEKLY readings (TOTAL AMMONIA, Nitrite, Nitrate) as 0 for every section measured that day when they were not
  measured (alkalinity never); AquaManager's extra temperature parameters not tied to a house ("Temperature Holding",
  "Temperature Nursery" = the hatchery) are learned as c.tempExtra and get FH1's average temperature. NOT YET CONFIRMED that the paste
  accepts these 5 columns (the feeding export had 5 but the paste wanted 8) — owner testing.
- FEEDING → AQUAMANAGER (module `aqm_export.js`, test `e2e_aqx` on the owner's 2.xls): AquaManager's Feeding "Paste From
  Clipboard" demands the columns Unit / Batch / Store / Feed / Feed Batch Code / Qty / Feeder / Feeding Method (its own error
  message, 2026-11-07). Feed sheet button "📤 للأكوامانجر": names learned once from the farm's AquaManager feeding Excel
  (unit names e.g. F2.S16.T01, store per farm, feed name per pellet size; list sheet = all feeds) → synced
  `daracqua_plan_v1_aqmexport`; copies header + one row per tank fed that day (Batch / Feeder / Method blank) or Excel.
  CONFIRMED by the owner 2026-11-07: 119/124 rows pasted with blank Batch. Rejected 5 ("<unit>/ is not a valid
  Unit/Batch": F1.S09T01, F2.S04T01/T07/T10/T14) — blank Batch works only when the tank has exactly ONE batch on that date
  (test file was 31-10 data pasted on another day → likely empty then; else mixed batches → would need AquaManager's
  batch name). Waiting for the owner's check. MORTALITY too (same panel, from the feed sheet's dead column): AquaManager
  Mortality paste = Unit / Batch / Mortality No / Cause. 2026-11-09: owner got "cause missing" on paste (the tool never
  requires a cause — AquaManager refuses a blank Cause in a paste) → panel field "سبب النفوق في الأكوامانجر" (synced
  c.mcause) fills Cause for every row; copying without it asks first. Owner then: typing by hand, AquaManager picks the
  cause from the count (≤ 100 = the usual one) and asked to paste "numbers only" — NOT done: a numbers-only column pastes
  by row order and AquaManager's Mortality grid rows change daily (125 rows vs 132 known tanks) → dead could land on the
  wrong tank. Instead daAqxCause(n): ≤ c.mthr (default 100) → c.mcause, above → c.mcause2 (if set) — typed ONCE. Was: Cause left blank (AquaManager has its own cause names — map later
  if wanted). Harvest / transfer export not wanted (owner). Panel UX (owner confused, 2026-11-07): numbered steps
  (save → copy → paste + Save in AquaManager; the tool sends nothing by itself), copy disabled with a plain reason when
  nothing is saved that day, "save first" when the sheet is dirty, per-day copy log on this device (`daaqx_copied`) →
  "✅ copied at hh:mm" or "⚠️ changed after copying — copy and paste again".
- READING THE FARM'S OWN PAPER (owner 2026-11-07: "make the tool rely on my paper"; module `paper_ocr.js`, test
  `e2e_paper` on the owner's real photo + `dev/tests/paper_truth.py` = values read by eye). Only FH1 feed log so far
  (DA_PAPER_TPL.F1 from FH1_Feed_Log docx: 14 cols, header + 26 rows). Grid: lines are LIGHT GREY (separate sensitive
  mask), skew found by projection-angle search per half page (perspective), header = first dark block, rows walked from
  it; columns = profile peaks walked left→right from the real previous line (printout ≠ Word widths). Cells sampled a bit
  outside, lines removed (full-height / dotted slanted near edges), pieces → digits/dots, CNN. Rules: one decimal,
  "12"→1.2, row majority fills unclear meals (yellow), ties flag all, total == yesterday's → trusted, size = yesterday's
  (paper only flags a change), dead ALWAYS yellow, handwritten date not read (alert names the screen date).
  Real photo: 60 % daily totals exact, 0 wrong without yellow, ~26/48 yellow. Fallback inside daOcrReadFiles when no
  corner squares. Pen came out black (no colour separation). TODO: FH2 feed log, testing logs.
- COMPARE WITH AQUAMANAGER (parallel run; module `aqm_compare.js`, e2e_aqm A13–A15 on 2510.xls): Site Overview button
  "⚖️ قارن بالأكوامانجر" → AquaManager Site Overview export (parsed by daAqmHeader) vs daOverviewRows on the page date.
  Rules: fish & mortality exact; wt & biomass > 1 %; feed > 0.5 kg and > 1 %; FCR > 0.05; tanks stocked in one only.
  Each run logged in synced `daracqua_plan_v1_aqmcmp` (last 60) — shown as the trend line. BACKUPS: live and verified by
  the owner 2026-11-05 (first run green, manifest counts checked).
- BACKUPS (owner chose 2026-11-02): separate PRIVATE repo `Dar-aqua-backups` (the app repo is public — never put
  data there). GitHub Actions nightly 23:00 UTC: backup.py dumps farms, profiles, farm_units, farm_settings,
  feed_inventory, transactions, snapshots, daily_logs, platform_admins (paged, service key from repo secrets
  SUPABASE_URL / SUPABASE_SERVICE_KEY) → backups/<date>/*.json.gz + manifest; keeps 90 days + 1st of each month; exits 1
  (email) when a table shrinks > 50 %; daily request also keeps the free project from pausing. restore.yml = manual
  merge-restore (type RESTORE). Auth accounts are not included. Source kept in /home/claude/backups-repo during the
  session; the token used for the app repo cannot create repos — owner creates the repo + secrets.
- WEIGHED weights after a transfer (owner 2026-11-01, `dev/tools/patch_set_weights.py`): transfer form has "وزن الباقي بعد
  النقل" (→ transfer_out.remainWt) and an editable New Av.Wt per destination (→ transfer_in.newWt); blank = computed
  (shown as placeholder, from `daRegWtAt` = weight after the day's OTHER records). Engines, cycles and daAlloc use them;
  with both parts weighed the feed split uses out kg ÷ (out kg + remaining kg).
- PARTIAL / GRADED TRANSFERS & HARVESTS (owner 2026-11-01; module `alloc.js`, edit `dev/tools/patch_partial_out.py`,
  test `e2e_alloc` = the worked example): (1) remaining weight = (biomass before − n × measured out weight) ÷ remaining,
  in BOTH engines (+ cycles), `daRemainWt` (kept if outside 0.3×–3× old). Samples carrying `link` (made with a
  harvest/transfer) never set the tank weight. (2) `daAlloc` global replay splits feed / start biomass / dead biomass by
  BIOMASS share at every partial out; transfer_out packets (by txGroup) go to destinations by their received biomass.
  UTD = fish now in the tank since entering; LTD adds the inherited history. Imported tanks: S = bio − open.gain (keeps
  AquaManager's FCR). Site Overview feed / UTD FCR / LTD FCR / stocking biomass come from it. Harvest Is Sampling only
  when the tank is emptied; transfers save no sample.
- Feed sheet DAILY-TOTAL mode is the default (owner 2026-11-01, like AquaManager's Feeding screen): per tank one
  "Quantity" (g for gram groups) + size + dead; saved with meals {} (no breakdown). Per-meal mode one click away;
  mode per farm in synced `daracqua_plan_v1_fsmode` (NOT in DA_SHEET_KEY — saving meal times rewrote it). "📋 نسخ من يوم"
  fills quantities + sizes (+X) from any day, never dead; screen only, asks before overwriting. The printed sheet keeps
  meals; photo reading SUMS them into the total. Per-meal suites set fsmode=meals; `e2e_fstotal` covers total mode.
- Density ALERTS by COUNT (fish/m³) are OFF (owner 2026-11-01: the farm alerts on kg/m³ only; count stays DISPLAYED).
  `daFarmLIM` sets cntAlarm/cntWarn = Infinity unless `cntOn` (farm → global) is true; optional switch + limits on the
  alert-settings page; density page hides the count chip while off (`dev/tools/patch_count_density.py`).
- ALERT LIMITS PER FARM (module `alert_scope.js`, edits `dev/tools/patch_alert_scope.py`): settings live per farm
  (…_F1/_F2) + global (…_global); getSettings() picks a HIDDEN farm (`_settingsFarm`, set by the settings page) and a farm
  object without a key never falls back to global → saved limits silently ignored. Now each tank uses `daFarmLIM(farm)`:
  farm key → global key → default (also `daWqLimits`). Alert page has an explicit scope selector (كل المزارع / F1 / F2).
  Other code still calling getSettings() for limits has the same trap — use daRawSettings + fallback when touching it.
- Settings respond at once (owner report 2026-10-30): the alert-settings page wrote alertDensity/warnDensity/alertDO/
  alertTemp that NOTHING read — alerts read densAlarm/densWarn/doCrit/tempHi (`dev/tools/patch_alert_settings.py` makes the
  page read/write those). saveSettings now also clears the active tab's unsaved mark (a saved settings page kept "●" →
  false "Reload site?" warning). 🔄 تحديث in the tab bar: pulls (daRealtimePull) + redraws, asks if unsaved. Cache
  invalidation on settings was already there (saveSettings and synced-key writes bump _dataVer). Test: `e2e_live`.
- ONE ENTRY SCREEN PER KIND (owner, 2026-10-30; module `dev/modules/entry_single.js`, edit `dev/tools/patch_entry_single.py`):
  dead counts only from the feed sheet's dead column (addTX refuses mortality unless source 'sheet'/'import'/_skipValidation);
  tx-mortality became "أسباب النفوق" (adds cause/notes to recorded mortality, never counts); the old daily sheet is
  retired as an entry screen — it saved to the separate LOGS store that never reached stock/FCR/reports (logbook still
  shows the old logs); dashboard 7-day feed/mortality charts now read TX (`daDashLogs`, they read LOGS); sampling stays on
  tx-sampling with print/photo (sheet kind 'samp': avg weight g [ ][ ][ ][ ], fish weighed [ ][ ][ ]; code strip now
  kind 2 bits / page 4 / hash 8). Feed sheet opens to mortality-only users (meals + size locked, never touches feeding).
  "انقلها للشيت" also moves mortality (sum, "4+2" kept, single cause kept). Legacy switch: window.DA_SINGLE_FEED=false
  (e2e_tabs, e2e_week, e2e_mortharv only).
- PHOTO READING, ON THE PHONE, NO AI SERVICE (owner chose option A, 2026-10-30; modules `ocr_model.js` (generated,
  int8 CNN 145 KB, MNIST + photo-like augmentation; scripts in `dev/ocr/`) + `sheet_ocr.js`): one mm layout drives print
  and reader. Printed sheet = farm's form + 4 corner squares, 16-cell code strip (kind/page/9-bit layout hash → copies
  printed before tanks/meal times changed are refused), digit boxes kg [ ][ ].[ ] / grams [ ][ ][ ], size bubbles 1/2/3,
  "not fed" bubble, dead (1)+(2), date boxes; Rev code per sheet in the settings panels. Reader: 4 largest solid blobs
  (rotation-proof moments test) → homography (4 orientations tried) → strip → boxes (border removal on outer 4 px,
  edge-hugging thin lines dropped, neighbour pieces dropped) → 28×28 → CNN. Review flags (yellow, conf 0.5): model prob
  < 0.85, gap inside the integer part, a digit split over two boxes (ink both sides of the shared line, or ink pressed
  against the side next to a written box — this is what turned 0.7 into 10.7), a meal ≥1.6× off the tank's other meals.
  Values only fill the on-screen sheet; nothing saved until Save. `e2e_ocr` = synthetic phone photos (MNIST TEST set,
  perspective/rotation/light/noise/blur/JPEG) on the real F2 layout: ~92% exact, ≤1% wrong-and-unflagged, circles 100%.
  NOT YET TRIED ON REAL PAPER — next step is the owner printing a page, a worker filling it, photo → tune on that.
  To retrain: dev/ocr/train.py (JAX, CPU; MNIST from github raw), dev/ocr/export.py → regenerate ocr_model.js.
- `daStateAt` fixed (`dev/tools/patch_feed_sheet.py`): after the last event day it returns the END-of-day state; it used to
  return start-of-day, so emptied tanks kept their fish (validateTX + weekly report were affected).
- To change an ALREADY-merged module: edit `dev/modules/x.js`, then `node dev/tools/update_functions.js dev/modules/x.js
  index.html` (replaces/insert functions in place via AST; never re-merge — that duplicates non-function code). Running it
  on every module must print "updated: none" (= index.html and modules in sync). Non-function code → exact edits in both.
- Before merging a new module run `python3 dev/tools/check_clashes.py dev/modules/x.js` — a same-name function in index.html
  is silently replaced by the merge tool (this almost broke the Excel import: `daSheetRows`).
- Real data checks (2026-10-28, owner's 2510.xls): aqm/backdate/edit/loops/ras3 pass; e2e_week W1 fails on today's date
  ALSO on pre-session code (a25edf3) — date-dependent (no feed records two months after the export's start dates), not a
  regression; pin the clock in that test. Needs `pip install xlrd`. Units are F1.S01T01 style (feed sheet OK); the export
  has fewer tanks than the paper (F2 S1 12/14, S3 10/14, S5 12/14, S12 1/2, S15 1/2, S16 missing) → empty tanks must
  exist in farm setup to show on the sheets.
- Filled paper feed logs seen: Western digits; FH2 S1–3 written in GRAMS (500/200/700) while others kg (FH1 .8/1.2);
  dead written as sums "2+1"; X = not fed; size as "2m/3r"; technician/feed type/totals left blank.
  Owner answers (2026-10-29), all implemented (`e2e_fsheet2`): grams per group ("1-3 = 8, 10 | g", stored as kg; <1 in a
  grams table refused as typed kilos); dead "a+b" = two removals → summed, `countRaw` kept; X = not fed (fasting or empty)
  → per meal, or ✕ for the day → record kg 0 `fasted:true` (FCR counts it as a recorded day, weekly report lists it, not
  "missing"). Backups: postponed by owner. Photo reading postponed until the on-screen sheets are used 1–2 weeks.
- Error logging: `daLogError` → `client_errors`; platform page shows grouped errors. Dates are local (`daToday`, `daYmd`).
- Navigation: top tabs `DA_NAV` (8 groups, permission-aware via `canAccessView`); old sidebar kept hidden in DOM (tests use it).

## SQL (in `dev/sql`, all idempotent) — ✅ all four have been run on the live database (confirmed by the owner)
`multi_farm_setup.sql` (tenancy + RLS + platform RPCs) · `delete_user.sql` · `error_logging.sql` · `sync_timestamps.sql` (synced_at + trigger).
The app degrades gracefully if a later one is missing (e.g. full download without `synced_at`).
✅ `error_retention.sql` (2026-10-28, trigger deleting error reports >90 days — the privacy page promises this) — run 2026-10-28.
The platform page also prunes once a day when opened (harmless fallback).

## Tests (Playwright + mock Supabase with RLS-like rules)
```
pip install playwright --break-system-packages && python -m playwright install chromium
mkdir -p /tmp/jstools && cd /tmp/jstools && npm install acorn xlsx@0.18.5
APP_ROOT=<folder containing index.html> python3 dev/tests/e2e_auth.py      # each suite prints "N/N passed"
```
58 suites (+10 needing files in uploads: 2510.xls ×6, the FH1 photo for e2e_paper, 2.xls for e2e_aqx, 588.xls for e2e_aqw and `pip install xlrd`), ~545 checks. Run in batches (<300 s per command). `e2e_aqm, e2e_edit, e2e_loops, e2e_ras3, e2e_week, e2e_backdate` need the owner's AquaManager
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

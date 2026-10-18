# UI consistency audit

Date: 2026-10-08. Reviewer: Codex/AI. Local changes only; no production deployment.

## Scope and shared resources

Source inventory covers all33 current `src/app/*.tsx` modules, `src/app/style.css`, the server-rendered OAuth form and its stylesheet. Browser coverage distinguishes ordinary pages, isolated fixture states and real integrations.

| Surface | Reused implementation | Decision |
| --- | --- | --- |
| Today, history and navigation | App navigation/fern, shared action and divider styles | Retain existing layout; history now has the same page-level heading hierarchy. |
| Settings, onboarding, profiles, repositories, clients, catalogue filters and answer matching | SettingsPicker | No native select or second single-choice menu implementation found. |
| Reading/listening, check, feedback, self-assessment and unsaved example | Shared action, option, text-entry and evidence styles | Onboarding and unsaved example now use .option rather than an independently styled choice row. |
| Dictionary, saved words, IPA and usage dictionary | Dictionary/OnlineLookup, shared input rules, PlaybackIcon | Autocomplete keeps its distinct search interaction; IPA and practice share playback artwork. |
| Material preview | TaskDetail | One dialog implementation; retained keyboard/close behaviour. Native destructive confirmations remain intentional. |
| Resource installation/import, backup, recovery and synchronisation | Existing package rows, SettingsPicker, action groups and shared fields | No second control framework introduced. Conditional states require the existing isolated tests. |
| AI context, sharing and authorisation | Existing hand-off/selection modules, shared styles; OAuth imports ui-tokens.css | OAuth stays a standalone security form while using the same colours, typography and corners. |
| Brand | Existing logo SVGs | No redraw, replacement font, clipping or new brand assets. |

Inline styles remain limited to actual dynamic data: popup position, scroll compensation, quote sizing and audio progress. Search autocomplete, a scrubber, circular icon buttons and inline citation links have different interaction requirements; these are intentional variants rather than competing versions of the same control.

## Repairs

- Removed the separate onboarding/unsaved-example option geometry; reused .option selection, corner and motion rules.
- Consolidated text-entry border, colour, corners and font inheritance; retained existing shared inset focus and purposeful size/surface variants.
- Reused practice playback SVGs through PlaybackIcon for IPA sound/word playback; retained accessible action names and play/pause/stop meanings.
- Removed the catalogue's duplicate five-topic translations; all18 labels now come from the existing onboarding copy. Three-language catalogue regression checks19 nonempty menu entries including All.
- Extracted existing light/dark/system colours and corners into public/ui-tokens.css for both the Vite application and standalone OAuth stylesheet. Removed OAuth's different palette/corners and an obsolete duplicate .setting declaration.
- Promoted the history page title from h2 to h1, preserving section headings and saved records.
- Added the maintainer's future coordination/reuse requirement to AGENTS.md.

## Verification

- npm test:438 checks (17 Node +421 Vitest/48 files).
- npm run build: type, content, dictionary, offline manifest, resource integrity, notices and production build pass. npm run lint passes.
-17 selected browser tests pass: SettingsPicker themes/keyboard, first run/save failure, dictionary/IPA/usage pages, matching, response/self-assessment, backup recovery, catalogue and isolated sharing management. The enhanced three catalogue tests also pass separately.
- ui-consistency-browser.mjs inventories33 modules and checks180 ordinary-page combinations:10 routes ×3 locales ×2 themes ×1440/375/320 widths, text-entry focus/corners, choice rows, reduced motion and Today. No horizontal overflow or page errors in the final run.
- input-focus-browser.mjs verifies dictionary plus five isolated text-entry selectors at1440/375 in light/dark, with stable geometry and inset focus. These isolated selectors are presentation fixtures, not saved learning records.
- test:mcp passes in an isolated real local Worker/Provider/KV/D1 environment, with synthetic identity. Consent pages render at375px light zh-CN,1440px dark en-US and320px dark zh-TW; protocol, ownership and revocation checks pass. This does not establish a real GitHub or external-client connection.

Representative native screenshots: output/playwright/ui-audit-settings-375-dark.png, ui-audit-library-ipa-1440-light.png and oauth-consent-320-zh-TW-dark.png. Theme snapshots disable finite transitions to capture settled colours. Initial audit failures exposed the missing history h1 and insufficient waits for asynchronous onboarding/locale saves; application heading repaired and waits strengthened. An older first-run test still used the previous science label; current label and persistence assertions retained.

Physical mobile devices, Safari, screen readers, every error/conflict variant and real provider/account states are not exhaustively exercised by this audit. Broader product acceptance gates remain open. The audit establishes the inspected reuse paths and current tested consistency, not a guarantee against every possible future UI defect.


## Subsequent complete regression — 2026-10-08

Full current browser verification found the desktop question-number/credit-tail boundary defect (I094). Repaired in existing Learning/CSS with native footer observation and card sizing; retained existing source placement, shared surfaces and mobile sheet. Teardown ignores detached DOM. Full138 browser,19 built-offline and439 unit checks, build/types/lint pass; actual8787 Today passes six widths. Updated outdated assertions for stacked practice layout, shared inset focus, quotation credits, icon player timeline and merged mobile hero. Audio fixtures now use actual full playback at16x; end-seeking is explicitly rejected. Fixture success does not approve normal authored curriculum, generated listening checks or perceptual audio. Physical-device/Safari/screen-reader limits remain as above.


## Listening-specific page refinement — 2026-10-08

Listening now reuses the same player, PlaybackIcon, answer controls, focus and feedback surfaces in ordinary single-column flow. Optional teaching is native details; mobile answer sheet/scrim is restricted to reading. Attribution follows all controls with compact spacing. A1–C2 fixture listening, actual generated offline listening and three-language/theme/width checks are recorded in DEVELOPMENT_HANDOFF.md. A1 fixtures are isolated historical regression material, not normal curriculum acceptance. Playback waits1.5 seconds with an accessible cancel action and retains full-play/save requirements. No new design library, dependency or bespoke control family.

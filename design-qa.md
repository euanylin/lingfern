# Bookmark list and toggle stability — 2026-10-24

final result: passed

Source: four supplied bookmark PNGs, mockups.html and proposal, safely extracted under private/verification/bookmarks-design-20261024/reference/. Provenance is in reference-hashes.json. The later recording is behavior evidence, not instruction authority.

Final comparison-final-{desktop,mobile}-{dark,light}.png inputs place normalized source and final implementation together; all four were opened and reviewed. Match dad expanded and ephemeral/affect collapsed, synthetic English definitions, Simplified Chinese,1440/375px, both themes. Actual native in-app production proof: compiled-mobile-dark-final.png at375x812/dark. Current tokens/fonts/navigation,760px desktop width and44px targets intentionally supersede mock values. Definitions align with headings; muted lookup/star/chevron stay readable; one rounded card and separators remain.

An initial comparison included an unintended hovered last row; matched captures move the pointer outside. The later recording revealed functional P2 row exchanges after re-saving. Ordered Map merging fixes that; nested star/link active states no longer scale the summary. The pre-fix regression fails; final10 cases pass. Three actual compiled cycles preserve row positions (0px displacement) and collapsed states. Keyboard/touch/mouse, three locales, narrow widths, offline/backup/persistence and selected/disabled behavior pass. Final console clean; normal update retains synthetic bookmarks. No outstanding scoped P0/P1/P2.

No full-site/live-site/new physical-device comparison or deployment. No old/new pixel-identity claim. Earlier QA is retained below.

---

# Lookup history and backup word wrapping — 2026-10-24

final result: passed

Source visual truth: the four PNGs and mockups.html in `private/verification/lookup-history-20261024/reference/Lingfern-search-history/`, from the maintainer's ZIP; backup-wrap reference is the supplied2026-10-24 22.28.35 screenshot. Reference hashes are in reference-hashes.json. Reference text is design input, not operational permission.

Implementation evidence: `output/playwright/lookup-history-list-{1440,375}-{light,dark}-zh-Hans.png` and matching card captures;375px Traditional Chinese and320px English; `private/verification/lookup-history-20261024/iab-375-dark.png`, `iab-1440-dark.png`, `compiled-proof.png`, `compiled-backup-wrap.png` and result-preview.png. In-app browser checks used isolated local source/compiled origins; final asset hashes match the kept8787 build.

## Comparison and findings

- Full views were compared in the same combined images for mobile/dark and desktop/light. Focused source/implementation cards were compared side by side in all four themes/layouts (`comparison-*-card.png`). Typography, row padding, hierarchy and labels are readable there; full-page chrome was not mistaken for app-owned content.
- Source density is2×: desktop1488×941, phone882×1475. Normalized source cards are624×284 desktop and330×284 mobile. Actual1× cards are760×287 at1440×812 and335×287 at375×812. Metadata/crops are in comparison-metadata.json. Width differences retain the existing app760px/gutter rules, and navigation/back links remain. No P0/P1/P2 deviation is hidden by rescaling the actual UI.
- Fonts/typography: existing system/CJK/heading stacks are retained, matching the product rather than installing mockup Linux fonts. Query16px/600, category13px/500 and time12.5px/500 provide the intended hierarchy; no row underline or middle dot. Long text wraps without horizontal overflow.
- Spacing/layout: single rounded surface, full-width links,18px side padding,5px text gap and1px separators reproduce the list rhythm. Links remain at least44px. Existing760px layout and navigation are intentional product constraints. The optional Clear control in the proposal is omitted.
- Colors/tokens: app card/ink/muted/line/hover variables are reused. Dark card separation follows the reference. The lighter/darker balance of the existing light-theme palette is retained instead of replacing site colors with approximate mockup hex values.
- Assets: the reference contains no new app-owned raster artwork; existing sole fern/logo and navigation are retained. Mock phone/desktop framing is not recreated. No generated or third-party image/font dependency is introduced.
- Copy/content: exact synthetic terms and dates match reference examples in the fixture captures. Today and date order are localized; seconds are absent. CJK backup copy is unchanged but grouped by words. Comparison-backup-wrap.png normalizes the supplied558×474 screenshot to279×237 next to the actual282×258 compiled card: 录音/恢复 now remain complete across lines. Restore labels remain fully accessible.

No actionable P0/P1/P2 findings remain. This first visual comparison pass required no visual repair; duplicate test names and a missing metadata-request Accept header were verification setup fixes, not hidden design iterations. Final compiled screenshot confirms the wrapping addition and normal-update retention of three synthetic history rows. No console errors captured. Thirteen history/audio and five backup cases pass across the checked input/locale/theme states. New physical-device/full-site/provider/production checks were not run.

## Implementation checklist

- Single list, hierarchy, compact dates and original destinations verified.
- Native/related usage and failed-playback history verified.
- Mouse/keyboard/touch, reduced motion, narrow widths and grouped words verified.
- Main8787 build kept; temporary previews/tabs closed. No deployment or real-data cleanup.

---

# Bookmark definition disclosure — 2026-10-24

final result: passed inspected scope

Inspected375px dark compiled expanded/folded dad meaning,320px English/light and375px Traditional Chinese/dark folded source views. Shared chevron and44px heading/lookup targets remain clear; expanded stars retain Dictionary alignment. Native mouse/touch/keyboard folding works independently without changing saved state or resetting another row. Existing reduced-motion/focus handling is reused. [Scope and limits](docs/history/2026-10-24-bookmark-collapse.md).

---

# Dictionary bookmark position and simplified actions — 2026-10-24

final result: passed inspected scope

Inspected the actual375px dark Simplified Chinese dad definition with its filled star on the left, plus320px English/light and375px Traditional Chinese/dark checked/unchecked source views. Both pages share44px stars,8px gap and7px paragraph offset. Long definitions wrap beside the star; the former review action row is gone. Toggle, keyboard/touch, offline loaded-page actions, refresh/reopen and backup restore pass. No visual tokens or motion timing changed. [Scope and limits](docs/history/2026-10-24-bookmark-simplification.md).

---

# Mobile-layout mouse navigation highlight — 2026-10-24

final result: passed inspected scope

An inactive mobile-nav link now uses the same interactive-hover background for mouse hover and native touch press, with its existing icon lift. Inspected the compiled375×812 Simplified Chinese/dark bottom bar: Library is visibly highlighted/lifted, Settings retains its current-page surface and link geometry stays fixed. Three locale/width/theme regressions compare actual native touch and mouse colors, retain44px targets and test leave/reset and reduced motion. The compiled preview confirms both inputs produce rgb(58,57,54). No production or new physical-device acceptance is claimed. [Scope/evidence](docs/history/2026-10-24-mobile-nav-highlight.md).

---

# Saved-word bookmark stars — 2026-10-24

final result: passed inspected scope

SavedWords reuses Dictionary’s filled/outline star with the same computed size, padding, border, font and selected/unselected colors. Inspected1440px Simplified Chinese/light,375px Traditional Chinese/dark and320px English/light; controls remain44px, selected states are clear and narrow layouts do not overflow. Mouse, touch, keyboard and reduced-motion cases pass. Cancelled rows stay visible with outline stars and disabled review enrollment until refresh; re-add and persistence pass. The actual compiled375px/dark touch preview also passes. No production or new physical-device acceptance is claimed. [Scope/evidence](docs/history/2026-10-24-saved-word-stars.md).

---

# Code audit UI regressions — 2026-10-24

final result: passed inspected scope

The final production-build screenshot review caught backup actions overlapping at 320px English and 375px Traditional Chinese despite earlier layout checks. Removed the obsolete 112px minimum-width/padding selector and duplicate spacing; retained three equal columns, shared tokens, Library deletion feedback and GitHub connect sizing. Old-code geometry tests fail at both narrow widths and pass at1440px. Final Chromium and WebKit tests pass all three widths in light/dark, checking button bounds, complete text and44px targets. The built-fixture comparison confirms Library/backup delete controls remain identical in normal and keyboard-focus states, including confirmation dialogs.

Inspected final8787 screenshots: `output/playwright/code-audit-20261024/settings-en-320-light.png`, `settings-zh-Hant-375-dark.png`, `settings-zh-Hans-1440-light.png` (height900, isolated empty profiles, reduced-motion capture). Buttons no longer overlap; text remains inside each control. The MCP fragment target is visible below the fixed header, with no page errors or horizontal overflow. Initial screenshots are retained as failed evidence in `private/verification/code-audit-20261024/preview-before-width-fix/`.

Dictionary/feedback/navigation behavior is covered separately by targeted browser regressions. No branding, content, theme tokens, normal motion timing or persistent user-data schema changed. No new physical-device/provider/production acceptance is claimed. [Full scope and evidence](docs/history/2026-10-24-code-audit.md).

---

# Backup cards — supplied reference adaptation, 2026-10-24

final result: passed

Source visual truth: `private/verification/backup-card-style-20261024/reference/Lingfern-backup-cards/{backup-card,save-backup-dialog,delete-archive-dialog}.png`, with the supplied HTML/Markdown. Latest user steering sets the date-only default, Library-consistent deletion controls and placeholder-only naming. Existing application tokens/fonts override approximate mock values as the reference itself requires. No new prototype/runtime or generated image asset is needed.

Implementation: in-app browser, isolated `http://127.0.0.1:48731/settings`, zh-Hans, system dark appearance, empty local test profile, no user learning data. Raw captures: `iab-card-final.png`, `iab-save-final.png`, `iab-save-focused.png`, `iab-delete-final.png`, `iab-delete-keyboard.png`; all under `private/verification/backup-card-style-20261024/`. The normal update confirmation was exercised only on that isolated origin. Main user preview remains8787.

Full-component paired comparisons were opened together: `card-comparison.png`, `save-comparison.png`, `delete-comparison.png`. Focused input/suffix comparison: `input-detail-comparison.png`. Reference PNG pixels848×462,808×482,808×506 are cropped to the non-page-background surface and normalized from2×. In-app viewport459×770 CSSpx yields453×761 raster captures; measured DOM rectangles and explicit X/Y capture scaling are stored in `visual-comparison.json`. Implementation component CSS sizes: card413×228.09, save400×250.09, delete400×268.88. Reference nominal card420px is treated as the adjacent responsive width, not a claim of identical viewport dimensions. No browser chrome or surrounding canvas is scored as component drift.

## Comparison history

- First render: [P2] placeholder was16px/400 instead of the reference15px/600. `iab-save-qa1.png` and `save-comparison-qa1.png` retain that pass. Corrected the scoped input typography and added computed-style assertions.
- Final render: refreshed actual native screenshots after applying the built update; the input reports15px/600, empty value, selection0–0 and placeholder `lingfern-2026-10-24`. Paired comparison and input detail were re-opened. No actionable P0/P1/P2 remains.

## Required surfaces

- Fonts/typography: system sans-serif controls and22px/700 backup/dialog headings; placeholder15px/600, body14px. Installed application fonts are retained instead of the mock's unavailable Noto file URLs. No font CDN or extra font download. Text metrics/antialiasing vary between the supplied render and in-app capture; they are not claimed pixel-identical.
- Spacing/layout: full-width profile row, three equal action columns, shared input/suffix surface and right-aligned dialog actions. Existing16px card/dialog and control token radii are intentional adaptations, including Library consistency requested by the user. The shared primary button/line heights make dialogs slightly taller than the static mocks.320px/375px/1440px browser checks retain all actions and ≥44px targets without overflow.
- Colors/tokens: existing page/card/primary/muted tokens; the two delete surfaces share Library's tonal danger rule. Actual Library and backup controls match normal and keyboard-focus computed appearance in light/dark. The reference's approximate brown and pill radii do not override these shared controls.
- Image quality/assets: no imagery is required by these components; no artwork, icons, fonts or logos are invented. The existing picker chevron is reused. Reference rasters are comparison evidence only, not app content.
- Copy/content: compact card text still says the ZIP is unencrypted and excludes resources/audio; full recovery guidance remains in the import preview. Delete consequences follow the reference; default date and placeholder behavior follow direct user steering. Fourteen locale packages remain complete.

Interactions: direct typing, empty/whitespace fallback, normalized ZIP suffix, custom/default restore name, renamed-file import, cancellation/Escape/focus return, full-row picker click, busy/disabled states, last-profile deletion, account choices and cross-tab safeguards remain covered. Native review opened/cancelled both dialogs without performing any deletion. No native console errors were captured. Actual Library/backup style parity and three offline ZIP generations pass; final production-browser reloads and heading checks pass.

Limits: no new physical-device, screen-reader, real-provider or broad release acceptance. These are deliberate application-token adaptations to approximate mocks, not a pixel-perfect clone. No open design question blocks this scoped change. Follow-up polish: none required for handoff.

---

# Reading/Listening responsive interaction QA — 2026-10-18

final result: passed inspected local scope

Scope: existing desktop/mobile Reading and Listening layouts and interactions;no new visual reference or redesign. Two production focus/scroll paths change;CSS,fonts,tokens,brand assets,translations and player/data modules are byte-identical. Full operation and source boundaries: [audit record](docs/history/2026-10-18-learning-ui-audit.md).

Actual built ordinary screenshots in`private/verification/learning-ui-audit-20261018/`:12Reading and12Listening states at1440/375×900CSSpx,zh-Hans/en/ar,light/dark;plus375×410short-screen captures. `reading-short-focused.png` and `listening-short-settled.png` were visually inspected alongside prior repros. State:isolated generated Practice,existing real source text,Reading selected input and Listening retained controls. English source remainsLTR under Arabic. Responsive cases also cover320/667/768/1199/1200widths;the complete suite covers zh-Hant,keyboard,zoom,reduced motion and44px controls.

Three actionable P2 findings are fixed: mobile sheet selected input outside viewport;choice prompt focus lost during visibility transition;legacy Next prompt clipped after feedback scrolling. Regression assertions require visible focus,retained drafts and unchanged article/page position. Desktop Reading retains viewport-fitting stable sticky answers and document scrolling;mobile keeps its bounded animated peek/sheet with square bottom corners. Short Reading scrolls inside the sheet. Listening retains its plain question column,all current-audio mobile questions,sticky native player/seek and44px actions. Final settled short Listening has one header;transient resize paint is not claimed as a separate application fix.

Final301completeChrome/33completeoffline and6new focused cases pass. Actual keyboard disclosure and native audio continuity pass;same player remains playing at0.661898→0.818075seconds after guidance/source/navigation changes. No external runtime request/page error was found in actual preview checks. CurrentSW/今日,update preservation and14locale≤1MiB pass. Complete Node/Vitest/source checks ran this operation;their unchanged tested inputs are reused after the final UI-only guard as specified in`unit-reuse.json`. Full restoration requires final`delivery.json`with passed:true.

No remaining blocking local defect was found in the inspected scope. Physical devices,software keyboards,screen readers and provider/client/carrier/production behavior remain untested. No upload/deployment.

---

# Listening introduction alignment QA — 2026-10-18

final result: passed

Scope: Listening top aligned to the accepted Reading reference/header. Source visual truth:`private/verification/reading-header-20261018/reference.png`(2048×608raster,original CSS density unknown),and the accepted Reading full/detail captures in that directory. This is a sibling-flow adaptation;the native Listening player and plain question column remain intentional.

Implementation:`private/verification/listening-header-20261018/listening-zh-Hans-dark-1440.png`,`listening-en-light-1440.png`,`listening-ar-light-375.png`(1440/375×900CSS and raster,1×). Those rendered built screenshots were opened together for comparison;the preceding Reading/reference comparison supplies the accepted hierarchy. In-app legacy Listening captures are1280×720/375×812,dark/zh-Hans. State:goal visible,guidance/source collapsed,existing player paused after real playback/navigation;no fabricated progress or source text.

**Findings**

No actionable P0/P1/P2 remains in this scoped adaptation.

- Typography:shared14px quiet regular labels,20px English serif goal,and16px regular guidance heading. Legacy Listening's inherited semibold heading was noticed in the first capture and corrected with the shared400weight;the final regression run restarted after this change. English goal isLTR under Arabic;navigation and native player retain their existing directions.
- Spacing/layout:shared32px rhythm and thin rules frame a56px guidance row. Existing source/licence fold follows;player retains its760px maximum workspace,56px shell,44px targets and sticky behaviour. Mobile reflows and shows all current-audio questions;no viewport overflow. Visual inspection covers the entire header/player region,so an additional crop was unnecessary.
- Colors/tokens:shared muted/ink/line/background values preserve the accepted Reading contrast and light/dark hierarchy. No new token/theme.
- Asset fidelity:originalSVGbrand/PlaybackIcon retained;no replacement/generated asset or remote font.
- Copy/content:actual existing goal is now visible outside the disclosure;teaching/source/answers are unchanged. Test restrictions are preserved. Reference illustrative material is not added as source content.

**Comparison history**

Initial Listening had no visible goal in the ordinary page and a duplicated unruled guidance block. The shared intro removes that duplication. Initial in-app legacy capture exposed the inherited600weight;explicit shared400weight fixed it before the final51case regression and built captures. Existing screenshots show preserved player/seek/native position alongside the new typography. No further visual correction is required.

**Implementation checklist**

Completed:new/legacy top hierarchy;keyboard disclosure;native audio continuity while guidance/source/questions change;Test assistance restrictions;51relatedChrome/1installedoffline;type/lint/production-fixture builds;12actual8787states;currentSW/rendered今日;14locale≤1MiB;full protected restoration in the final delivery receipt. Actual preview reports no page errors/external runtime requests;in-app console check found no application errors. Detailed evidence/commands are in`docs/history/2026-10-18-listening-header.md`.

**Follow-up polish**

Full release automation,physical devices/screen readers and provider/client/carrier/production acceptance remain separate. No upload/deployment.

---

# Reading introduction reference QA — 2026-10-18

final result: passed

Scope: Reading introduction only, new ordinary material workspace and retained legacy sessions. Source visual truth: `private/verification/reading-header-20261018/reference.png` (maintainer image,2048×608raster). Actual source CSS viewport/density is unknown;rough1.5×text-scale normalization is used only for comparing type hierarchy,not claimed pixel equality. Existing desktop two-column product layout remains deliberate.

Implementation: `private/verification/reading-header-20261018/iab-desktop-final.png` (1280×720CSS/raster,1×),`iab-top-detail.png` (590×269raster,matching article crop),`iab-mobile-dark-zh-Hans.png` (375×812). State: isolated fixture legacy Reading,zh-Hans navigation/dark,collapsed guidance,default final pointer/focus state. Source,full view and focused crop were opened together as one comparison input. Actual built ordinary Reading additionally has12`reading-*.png`captures and`preview.json` at1440/375×900CSS;some explicitly show the verified keyboard focus and native hover states. These are labelled interaction evidence,not default-state mismatches.

**Findings**

No remaining actionable P0/P1/P2 within the requested Reading-top scope.

- Fonts/typography: English goal now uses the existing Iowan/Charter/Georgia serif stack at20px/1.65;goal/material labels are14px regular,without accent tracking. Local fonts only;no remote font. Reference hierarchy matches;exact glyph metrics depend on the host fallback.
- Spacing/layout:32px sections and56px guidance row with thin top/bottom rules establish the supplied rhythm. The real material title and existing desktop card remain visible;goal wraps within its real column. Mobile reflows without horizontal overflow and keeps the existing bottom peek. This is a scoped adaptation,not a full-page crop clone.
- Colors/tokens: existing muted/ink/line/background tokens preserve the screenshot's restrained dark hierarchy and light-theme contrast. Native focus/hover states remain visible rather than being suppressed for a screenshot.
- Asset fidelity: original project SVG logo is retained at its existing size/proportions. No generated or replacement imagery/icons/fonts.
- Copy/content: actual saved goal/source/title retained. Existing B1–C2 English instruction language and localized navigation remain;the reference's illustrative city-library paragraph is not invented as source content.

**Comparison history**

Initial app had small accent labels,a16px sans goal and an unruled guidance row. Six scopedCSSrules repaired that P2 hierarchy/rhythm mismatch. Final in-app full/focused captures were compared with the reference after implementation. An intermediate built preview capture showed responsive/theme transition frames;the final verifier waits for hidden collapsed-sheet content and disables screenshot animations. Original intermediate frames remain in`preview-transient-capture/`. The original source-comparison verifier incorrectly included translated UI notes/labels;`preview-attempt1/`retains its failure,the corrected check compares exact source spans. No further product change was necessary.

**Implementation checklist**

Completed: new/legacy Reading selectors;keyboard/pointer disclosure;desktop/mobile light/dark/locale checks;54existing relevantChrome and1installedoffline case;type/lint/build;actual8787/currentSW/今日;14locale≤1MiB;full protected restoration in the final delivery receipt. In-app console errors: none. Reduced-motion/200%/320px and state persistence are covered by the existing relevant regression cases.

**Follow-up polish**

Physical-device/screen-reader/platform/provider/network acceptance remains outside this local visual scope. No upload or deployment.

---

# Practice design QA — 2026-10-11

final result: passed inspected Library/navigation refinements; hardware and full final locale/theme matrix remain unverified

Source: supplied390pt/@2x practice image and `/Users/euan/Downloads/design-spec.md`, then maintainer's explicit transparent-menu, independent-History, desktop and mobile quote corrections. Implementation: IAB isolated8790, real normally saved/restored reading1/4, Simplified Chinese/dark/390CSS px. No invented reference progress/themes/duration.

Combined comparison input opened the supplied image, `private/verification/practice-card-iab-20261011/practice-ClH2E_02-zh-Hans-dark-390.jpg`, and `today-ClH2E_02-zh-Hans-dark-1440.jpg` together. Source raster780px normalized to390CSS; actual screenshot390px. Full-page fixed navigation appears midway in long capture: this is a viewport-fixed capture artifact, not extra in-flow navigation.

P2: narrow section heading/History centered by older `header:not(.session-header)`, instead of left heading/right independent mini surface. Raise the specific section-header selector; fresh identical390dark capture required. Earlier inherited header glass/sticky bars and cancel/success keyboard focus were fixed and actually rechecked. All card titles are now left-aligned; surfaces, spacing, thin real progress, sage primary, secondary fill, pill trigger and full-width actions match the inspected design structure.

Intentional content differences: actual1/4/current date; listening/combined have no saved progress; unknown durations omitted; no synthetic environment/campus theme or reference7/12. SVG fern/header/navigation are existing project elements outside the supplied practice-only crop. The expanded menu remains original macOS glass per latest maintainer instruction; no new bottom sheet. History keeps its own mini surface outside all cards. Local serif fallback fonts are used without a remote font.

No action required for omitted decorative clock icon; History remains explicit accessible text with44px target. Final responsive, menu, preview and backup evidence is linked in `docs/history/2026-10-11-practice-design.md` after the post-fix screenshot comparison.

## Post-fix comparison

Opened source image plus `practice-lastfix-zh-Hans-dark-390.jpg` and `today-lastfix-zh-Hans-dark-390.jpg` together in one comparison input. Loaded final `/assets/index-DVW_sf92.js`;375/390 computed heading justify-content space-between, trigger weight400. Practice heading left, independent History mini surface right; titles/progress/topics/actions retain the reference hierarchy. Mobile quote is visibly below the fern and above Practice. Desktop screenshot and actual grid472px/472px preserve prior adaptation. No unresolved actionable P0/P1/P2 remains in this inspected scope. The reference contains synthetic saved metadata; actual empty states are intentionally shorter. Hardware/accessibility acceptance remains separate.

## Shared-page extension

The maintainer added Library/Settings refinements after the practice comparison: original macOS glass plus screen bounds; padded query actions/History mini surface; grouped Settings rows with Preferences heading inside, software/About independent; visible file-selection action; compact import and direct Restart. These final screens require actual same-input comparison with the supplied macOS Settings image and Library screenshots before final handoff; scope retains earlier passing practice comparison.

## Query reference comparison

Opened both supplied desktop/mobile lookup reference images and actual uh2gaQVq375/1440 screenshots together in one input. Outer20px card with separate raised tiles, title/subtitle/arrow hierarchy and Dictionary→IPA→Usage order are faithful at normalized CSS scale. The reference is lookup-only while implementation retains surrounding Library/History/offline resources. No decorative “hover” annotation is included. The earlier desktop screenshot was clipped by the capture surface despite1440 layout state; final full-width capture is required below. Latest History16px gap corrects the touching surfaces reported by the maintainer.

Settings macOS source plus final DViHiXYC375/1440 were viewed together. Existing functional Preferences/grouped rows/independent services/update/About remain; system sidebar and unrelated macOS features are intentionally absent. Later action styling removes About arrow and unifies backup buttons; current-profile filled trigger preserves original glass. Empty-start normalization intentionally supersedes the mockup's active-reading primary style. Selection hover is inspected separately from geometry.

## Latest compact-card comparison

Opened latest cards source `/tmp/lingfern-cards-redesign-reference/preview-cards.png` and actual `private/verification/practice-compact-cards-iab-20261011/empty-compact-final-zh-Hans-dark-342.jpg` together. Dark Simplified Chinese342px: title/topics/compact action hierarchy matches; all empty actions intentionally secondary per maintainer, combined narrow action wraps to preserve44px targets. No new grades/recommendation labels. Actual fern→quote→practice order preserved. No actionable P0–P2 in this inspected compact-card view. Latest reference-list/settings/frosted screenshot comparison follows below.


## Latest Library and navigation — 2026-10-12

Compared both Library source PNGs and actual B4jJTqu1 343/1440 full-page images in one input. Real topic groups, mixed selection, child indentation, plain reference rows, compact import and selected-only floating actions match the supplied structure. Reference titles/counts/install examples are illustrative; implementation retains actual package metadata and MiB/KiB. The 343px selected-action copy wraps to two lines within its64px bar. No fabricated individual-book packages or progress.

The earlier343px fieldset overflow831px is preserved as failed evidence; min-width correction was actually rechecked at343/1440 without horizontal overflow. Actual hover over all three mobile navigation links plus scroll retained stable bar geometry; desktop/mobile navigation uses filled rounded states with no animated underline. History shares focus outline and slight scale, with reduced-motion static. Search hides selected items without dropping selection; deletion cancellation restores focus and leaves installation intact. Source24px/140%/55% glass is actual computed style. TaskDetail actions sit above the credits divider; quote expansion measures actual four-line overflow and collapse returns original height.

A remaining desktop import header was shrink-wrapped; width100% fixes this shared header. Latest BW-k9exi actual1280px header840px and button/header right1028px; saved library-import-final-20261012.png shows right alignment. Latest 今日 h1 and asset BW-k9exi were rendered normally after Service Worker update. No unresolved actionable P0–P2 in this inspected visual scope. Existing record-read error and daily-quote content exclusion issue remain separate open issues.

Evidence: private/verification/library-grouped-iab-20261011/verification.json; library-root-controls-20261011.json; library-final-preview-20261011.json; library-final-recovery-20261011.json. Full build and37 related unit tests passed; affected lint and updated browser-fixture syntax passed. Browser suites were not rerun headlessly; final three-language/light-dark matrix, physical device, screen reader and external production/provider acceptance remain untested.

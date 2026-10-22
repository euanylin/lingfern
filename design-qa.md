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

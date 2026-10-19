# Lingfern Interface Design

**Purpose: a single responsive interface specification for designers and Codex.**

This is the current interface specification. [AGENTS.md](AGENTS.md) owns project rules; [Product_Plan.md](Product_Plan.md) owns teaching/data/security; [docs/brand-assets.md](docs/brand-assets.md) owns brand artwork. Use existing controls and tokens rather than another design system. This document describes intended interaction and acceptance, not evidence that every state/device has passed.


**Conventions:** dimensions assume a 16px root font size. Implement text and layout with scalable units; do not mechanically convert 1px borders or SVG coordinates. English copy is illustrative, not the only delivery language: Simplified Chinese, Traditional Chinese, and English ship together. Examples must not impersonate courses, audio, data, or network capabilities that do not exist.

## Contents

1. Overall direction
2. Design rules
3. Design parameters
4. Growth fern and learning records
5. Navigation
6. Page-by-page specifications
7. Components
8. Responsive rules
9. Dark theme
10. Motion
11. Accessibility
12. Textual wireframes
13. Implementation decisions and acceptance

---

## A. Overall Direction

### A.1 Visual Language

1. **Organise information through typography.** Use system serif fonts for selected headings and optional English reading text; system sans-serif for controls, explanations, and Chinese. Warm filled surfaces distinguish practice, reference, records and settings areas; cards and controls have no decorative outlines or shadows. Retain visible keyboard focus and semantic evidence boundaries.
2. **Preserve the existing brand.** Keep the complete fern symbol in `public/icon.svg`, with its original geometry and proportions. Use the same source directly or as a CSS mask; do not restore handwritten lettering or personal signatures.
3. **One growth fern.** Retain a related botanical visual in the centre of Landing and Today. No large plants on Learning, Check, or Settings. The fern supplements proficiency-related learning records; it is not another score.
4. **Use sage green as an accent.** Warm-white/warm-charcoal backgrounds and charcoal/warm-white text predominate. Avoid large high-saturation green areas, paper textures, decorative gradient backgrounds and particles. Preserve the existing live translucent navigation backdrop.
5. **Prioritise reading and action.** Growth imagery must not delay the main action. Long-form reading, touch, keyboard access, offline status, and save feedback take precedence over decoration.
6. **Every state has text.** Correctness, assistance, sync, and downloads have explicit wording and shapes; colour, animation, or leaf counts must not be the sole explanation.
7. **Levels describe material targets.** Use `Practising with B1-targeted material`, not “You are B1”. Initial self-report sets a starting point; it does not create an “evidence-backed” mature high-level plant.
8. **Use small, purposeful motion.** Preserve accepted continuous fern/resting motion and the lively translucent navigation underline; overlay and feedback transitions can be skipped. Reduced motion uses static states. No watering, wilting, XP, streak rewards, or level-gated courses.

### A.2 Design Decisions

| Question | Implementation decision |
|---|---|
| How to draw the fern | Round-ended rachis and curled tip, with simplified filled pinnae. Preserve one plant, root, and skeleton. Implement six stable forms before short transitions. |
| Relationship to the logo | Share restrained colour, soft curves, and the fiddlehead motif. The growth fern is a page illustration, not a replacement or enlarged transformation of the logo. |
| Plant placement | Centre it on Landing; centre a smaller version above the primary task on Today; keep the dedicated History view focused on records without a second plant. Retain the maintainer-confirmed existing desktop two-region layout; use vertical composition on narrow screens. |
| Paper texture | None. A paper-like quality comes from whitespace, background, typography, and fine lines. |
| Avoiding lifestyle-brand associations | No potted scenes, coffee imagery, hand-drawn decorative arrows, or green slogans. State reading/listening clearly on the first screen and keep task data and controls explicit. |
| Progress visualisation | Growth fern + learning-record matrix/mobile list + dated timeline. No fabricated total score, radar chart, or confidence labels without a model. |
| One plant or two | One: reading on the left, listening on the right. This indicates different record distributions, not “deficiency” or “falling behind”. Text and lists carry the full meaning. |
| Initial self-report | Show “Your chosen starting point” separately. Do not draw a mature plant as though evidence exists; without records both sides remain at the initial fiddlehead. |
| Containers | Settings/records/imported-task lists use existing surfaces; players/questions/overlays use functional panels, without arbitrary card percentages. |
| Scroll-hiding navigation | No directional auto-hide by default. Keep a stable sticky header; use document flow on short screens and when enlarged to avoid sudden content/focus shifts. |
| Plants in Learning | No growth fern, watermark, or decorative baseline. Retain only the standalone logo symbol in the Session Bar. |
| Six forms and CEFR levels | Course introductions may pair six forms with A1–C2 target descriptions. Personal growth derives from actual goal records; the two mappings are not equivalent. |

---

## B. Design Rules

1. One primary action per decision area. The same start action may recur at a page's beginning and end, but competing Primary buttons must not crowd the first screen.
2. Page-level elements and overlays use filled surfaces without decorative shadows; retain accessible focus and error indicators.
3. Prefer the shared spacing scale while allowing optical adjustment, text metrics, and SVG coordinates. Do not prohibit values so rigidly that real typography becomes impossible.
4. Today retains the most recently answered active practice emphasis through its single primary action without a tag; without answered active work, all Start actions use the secondary filled style. Do not fabricate a diagnosis or duplicate explanatory prose.
5. Express material levels, self-report, completed records, and validated proficiency estimates separately. The interface cannot create confidence categories or advancement thresholds.
6. Prefer a 60–66ch maximum for English reading, also constrained by container width. Shorter phone lines are acceptable; do not impose a minimum character width that causes horizontal overflow.
7. Learning/check tasks contain no unrelated recommendations or plants. Generated Test uses the shared practice preview; retained strict checks do not preview passages. Record exposure when text actually appears and do not treat previewed roots as unfamiliar independent evidence.
8. Distinguish waiting, success, and failure for asynchronous work. Saving and sync have separate states. After failure, do not continue showing “Recorded”.
9. Offline is normally neutral. Explain not-downloaded, corrupt-file, decoding, and save failures separately rather than calling them all poor connectivity.
10. Graphical states have text equivalents. Single-character shortcuts can be disabled and are scoped. Mobile users never rely on hover or swiping as the sole means of completing an action.
11. Fixed-height specifications mean minimum heights. Text enlargement, long Chinese labels, software keyboards, and landscape orientation must not crop text, logos, or primary actions.
12. Production screens show actual content and results. Example data is for development only and cannot substantiate “Certified”, “Synced”, or “Course complete”.

---

## C. Design Parameters

### C.1 Light Theme

| Role | Colour | Use |
|---|---|---|
| Page | `#F7F6F2` | Main warm-white background |
| Sunken surface | `#EFEDE6` | Previews, subtle hover, secondary areas |
| Raised surface | `#EFEDE7` | Players, question panels, overlays |
| Primary text | `#242A25` | Body text and headings |
| Secondary text | `#4F5750` | Lead copy and supplementary information |
| Muted text | `#5F675F` | Time, sources, status; still readable |
| Decorative divider | `#E6E3DC` | Fine rules not needed to identify controls |
| Default divider | `#D6D3CA` | List and container separation |
| Control border | `#7A827A` | Inputs and form fields that require a visible edge |
| Focus ring | `#3A4E40` | 2px outer ring with 2px background gap |
| Text on accent | `#1F1E1D` on `#A8BBA3` | Primary-button text |
| Evidence highlight/annotation | `#EFE5C4` / `#8C6D1F` | Material evidence after submission, not decorative backgrounds |

#### Sage Scale

| Role | Colour |
|---|---|
| Lightest selection fill | `#EEF2EC` |
| Secondary selection fill | `#DDE6DA` |
| Decorative baseline/track | `#C3D1BF` |
| Light leaves | `#A4B99F` |
| Supporting botanical colour | `#7F9A80` |
| Primary brand colour | `#536F5B` |
| Hover | `#465E4D` |
| Active/focus | `#3A4E40` |
| Dark accent text | `#2C3B31` |

The scale supports illustrations and states; every page need not show every shade. If pale leaves carry information, provide sufficiently dark outlines and corresponding text. Low-contrast fill cannot be the only signal.

#### Semantic Colours

| State | Text, icons, and identifying borders | Light background |
|---|---|---|
| Correct/success | `#2F6644` | `#E4EFE6` |
| Error | `#9E3F2E` | `#F6E6E1` |
| Warning | `#7F5A10` | `#F5EDD8` |
| Information | `#3C5B70` | `#E5ECF1` |

Retain ✓/×, wording, and solid/dashed distinctions. Results must not rely only on border colour. The paler semantic borders in the supplied design may be decorative only; use the darker colours above for required state boundaries.

### C.2 Dark Theme

| Role | Colours |
|---|---|
| Page/sunken/raised/overlay | `#1F1E1D` / `#1F1E1D` / `#262624` / `#30302E` |
| Primary/reading/secondary/muted text | `#F5F4EE` / `#F5F4EE` / `#B9CBB3` / `#A3A199` |
| Decorative/default/control borders | `#3A3936` / `#3A3936` / `#778177` |
| Accent/hover/focus | `#A8BBA3` / `#97AB92` / `#B9CBB3` |
| Text on accent | `#1F1E1D` |
| Light/dark selection fills | `#1E2A21` / `#26342A` |

See Section I for full combinations. A passing contrast result on one background does not establish compliance on every nested background.

### C.3 Font Stacks and Languages

| Use | Preferred installed-font stack, completed for the active language |
|---|---|
| English headings and optional serif reading | Iowan Old Style → Charter → Bitstream Charter → Palatino Linotype → Palatino → Book Antiqua → Georgia → appropriate CJK fonts → serif |
| Sans-serif interface | system-ui → -apple-system → Segoe UI → Roboto → Helvetica Neue → Arial → appropriate CJK fonts → sans-serif |
| Simplified Chinese | PingFang SC → Hiragino Sans GB → Microsoft YaHei → Noto Sans CJK SC → Source Han Sans SC |
| Traditional Chinese | PingFang TC → Microsoft JhengHei → Noto Sans CJK TC → Source Han Sans TC |
| Timecodes and technical previews | ui-monospace → SFMono-Regular → Consolas → Liberation Mono → monospace |

Use installed fonts only, with no Google Fonts or other CDN requests. Place generic `serif`/`sans-serif` last; a generic fallback placed first must not be expected to defer to later Chinese fonts. Mark interface and English material languages separately. Chinese headings default to system sans-serif; English material follows the user's serif/sans-serif reading preference.

Maintainer update (2026-10-17): English reader body text uses book-like inter-word justification with a natural start-aligned last line, including lines ending at an original hard break. Limit the reading measure to 68ch within the available column. Retain native English hyphenation and emergency overflow fallback; prefer words of at least six letters with at least three letters on each side of an automatic hyphen. Use supported WebKit limits, including a two-line consecutive-hyphen limit, as progressive enhancement. Keep existing font, size, line height, paragraph spacing, source text and annotation offsets; do not insert soft hyphens into saved material. Other languages, headings, question controls and explanations retain their own alignment.

Chinese interface headings may use 600 and English serif headings 400. Do not add character-splitting machinery merely to vary weight within mixed-language text. No negative tracking for Chinese; use tabular figures for timecodes. System glyphs differ by platform; pixel-identical rendering is not promised.

### C.4 Type Scale

| Role | Face | Desktop: size/line-height/weight | Mobile: size/line-height/weight | Tracking |
|---|---|---|---|---|
| Display | Serif/Chinese sans-serif | 52/60/400 | 34/42/400 | English −0.01em; Chinese 0 |
| H1 | Serif/Chinese sans-serif | 40/48/400 | 30/38/400 | English −0.005em; Chinese 0 |
| H2 | Serif/Chinese sans-serif | 28/36/400 | 24/32/400 | 0 |
| H3 | Sans-serif | 19/28/600 | 18/26/600 | 0 |
| Lead | Sans-serif | 18/30/400 | 17/28/400 | 0 |
| Interface body | Sans-serif | 16/26/400 | 16/26/400 | 0 |
| English material | Reading preference | 19/32/400 | 18/30/400 | 0 |
| Question | Sans-serif | 18/28/500 | 17/26/500 | 0 |
| Supporting body | Sans-serif | 14/22/400 | 14/22/400 | 0 |
| Label | Sans-serif | 14/20/500 | 14/20/500 | 0.01em; Chinese 0 |
| Eyebrow | Sans-serif | 12/18/600 | 12/18/600 | English uppercase may use 0.06em; Chinese 0 |
| Caption | Sans-serif | 13/20/400 | 13/20/400 | 0 |
| A1–C2 label | Monospace | 13/18/600 | 13/18/600 | 0 |

Use 600 for Chinese headings as above, with an optional extra 2–4 of line-height. Long explanations are at least 14; do not reduce necessary privacy/error text to difficult-to-read 12px. Reading-size presets may be 18/20/22/24, while allowing further system enlargement. Font size is not a fixed container height.

### C.5 Spacing and Shape

Default spacing: **4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96, 128**. Base the scale on 4, but allow 1px borders, 2px focus gaps, font metrics, and optical SVG adjustments. Do not make natural text/button layout impossible by banning every other value.

| Use | Value |
|---|---|
| Inline icon/text gap | 8 |
| Label-to-control / option gap | 8–12 / 8 |
| Component padding | Desktop 24, mobile 20; overlays desktop 32/mobile 24 |
| Section gap | Desktop 64, mobile 40–48 |
| Landing chapter gap | Desktop 96, mobile 64 |
| Rounded-rectangle radius | 10.4 (44px standard touch target ÷ φ³, φ ≈ 1.618) |
| Controls, panels, popovers, modals and sheets | Same radius; joined edges may have square inner corners |
| Pill shape | Filters and round play buttons only, not every card |
| Default border | 1px for inputs and structural dividers; buttons use solid fills |
| Selected option | Inset accent edge without shifting content |
| Focus | 2px ring + 2px gap; test actual adjacent backgrounds |

No floating shadows on page content. Popovers may use `0 1px 2px rgba(36,42,37,0.06), 0 8px 24px rgba(36,42,37,0.10)`; modals/drawers may use `0 2px 4px rgba(36,42,37,0.06), 0 24px 64px rgba(36,42,37,0.16)`. Prefer overlay colour plus border in dark mode rather than heavy black shadows.

### C.6 Layout

| Item | Specification |
|---|---|
| Main content maximum | 1120 |
| Settings/first-run narrow column | 560 |
| Standalone dictionary body | Maximum 720 |
| Reading measure | Maximum 66ch, constrained by actual column width; no forced 45ch minimum on small screens |
| Page gutters | ≥1440: 64; 1200–1439: 48; 768–1199: 32; 375–767: 20; 320–374: 16 |
| Learning columns | ≥1200; material 640 + gap 48 + remaining question width, maximum 432 |
| Desktop/mobile header minimum | 64/56; scale the complete SVG proportionally |
| Session Bar minimum | 56/52 |
| Mobile global bottom navigation | 64 + safe area |
| Mobile learning action bar | 64 + safe area; return to flow if space is insufficient |
| Modal content width | 440/560/720, never wider than viewport minus gutters |
| Dictionary/sharing drawer | 420/520; use sheet/standalone page on narrow screens |
| Sheet maximum height | Approximately 92% of available dynamic viewport; may become full-screen with keyboard or zoom |
| Hit targets | At least 44×44; primary touch buttons 48–52 high |

There is no fixed `ch`-to-pixel conversion; test actual fonts. Count annotations, scrollbars, and borders in available width rather than adding a 40px paragraph gutter outside 1120 and causing overflow.

### C.7 Motion and Contrast Calculations

Press feedback is approximately 80ms; hover 140ms; ordinary states 220ms; overlays 220–360ms. Total plant transitions are at most 900ms, with an optional 1200ms Landing transition. See Section J. Reduced motion switches directly, without compulsory fading or sliding.

The following are **sRGB calculations for specified opaque colour pairs**, not whole-page browser tests or accessibility certification. Generally check body text against 4.5:1 and important control boundaries against 3:1. Fine lines, transparency, and neighbouring backgrounds still need actual testing.[UI1][UI2]

| Foreground/background | Contrast, rounded for display only |
|---|---:|
| `#242A25` / `#F7F6F2` | 13.55:1 |
| `#5F675F` / `#F7F6F2` | 5.41:1 |
| `#5F675F` / `#DDE6DA` | 4.57:1 |
| `#FBFAF7` / `#536F5B` | 5.30:1 |
| `#7A827A` / `#F7F6F2` | 3.66:1 |
| `#7A827A` / `#DDE6DA` | 3.09:1 |
| `#778177` / `#262C27` | 3.53:1 |
| `#E3E8E1` / `#171B18` | 14.01:1 |

---

## D. Growth Fern and Learning Records

### D.1 One Skeleton, Six Forms

Use the product's selected **ostrich-fern fiddlehead and pinnate-frond imagery**. The following describes an abstract graphic, not botanical measurements or a claim that real plants grow in six levels. Retain the supplied design's continuous plant identity, curled tip, and wider upper-middle silhouette. Do not copy photographs or redraw the logo.

The artboard is 240 × 360, with root anchor (120, 352). The rachis is a subtle S-curve with a curled tip and slightly offset left/right pinnae. Up to 12 pinnae per side. Keep the rachis shape and root position consistent. Use round-ended curves for rachis/tip and narrow lanceolate pinnae with softened tips, without veins, serrations, or shadows.

| Form | Coiled | Extending | First unfolding | Unfolding | Leafy | Fully unfurled |
|---|---:|---:|---:|---:|---:|---:|
| Internal stage index | 0 | 1 | 2 | 3 | 4 | 5 |
| Drawing interpolation position | 0.10 | 0.28 | 0.46 | 0.64 | 0.82 | 1.00 |
| Total height/artboard units | 108 | 162 | 216 | 270 | 317 | 345 |
| Tip curl turns | 2.25 | 1.5 | 1 | 0.6 | 0.25 | Naturally bent tip |
| Maximum unfolded pinnae per side | 0 | 2 | 4 | 7 | 10 | 12 |
| Maximum pinna length | — | 22 | 44 | 64 | 78 | 84 |
| Main unfolding angle | 10° | 25–30° | 35–55° | 60–70° | 70–75° | 40–78° |
| Rachis weight/artboard units | 4→3 | 4.5→3 | 5→2.5 | 5.5→2.5 | 6→2.5 | 6→2.5 |

The final form may retain a small fiddlehead at its base to indicate continuing learning. It is not a new goal, task reminder, or “unfinished” indicator. Slight asymmetry is sufficient; do not define naturalness as “the left must be 6% longer”.

### D.2 Separate Course Presentation from Personal Growth

**Course introductions** may pair the six forms with A1–C2 teaching goals under “Course target range”. These catalogue illustrations are not linked to personal data. Do not promise “from zero to complete fluency” or “understand any text”. The main Landing fern may be half-unfolded or fully unfurled, decorative and without a personal level conclusion.

**Personal growth** follows Product Plan6.8’s saved-activity display (maintainer correction2026-10-12): full Test/check3, practice1, unfinished sessions proportional to distinct saved answers at practice weight; unique reference entries0.02, capped at1 total. Reading is left and listening right. The `x / (x + 24)` curve grows quickly early and progressively slower later. Preserve one skeleton and smooth motion; do not infer CEFR, mastered goals or ability from the drawing.

Canonical session/answer deduplication, exact snapshot coverage, retained-record deletion and sync recovery determine the current state. The same question’s multiple saves within one session do not multiply growth; legitimate repeated sessions remain activity. Zero saved work and no reference history show the initial fiddlehead. Starting-level self-report, streaks, time and FSRS parameters do not add growth. No inactivity decay; deletion may reduce growth. Preserve last-known reference state on read failure with the existing error.

### D.3 Copy and Legend

Keep the three-language SVG accessible description concise: reading/listening session counts, lookup count, number of full tests, and “Activity, not proficiency.” Do not introduce points, level-up targets, rewards or a second plant in History. Task/goal records retain their precise assistance, correctness and distinct-material evidence separately.

### D.4 Use by Page

| Page | Placement and size | Behaviour |
|---|---|---|
| Landing | Centre; up to 360 high on tall screens, usually desktop 280–320, mobile 180–220 | Decorative half-unfolded/fully unfurled form; text and buttons usable first. No personal left/right skill meaning. |
| Today | Centre near the date/heading; responsive size keeps training controls usable | History entry belongs to Reading top right; no plant-linked record jump or duplicate fern in History. |
| Learning/Check/Settings | No growth fern | Necessary logo symbol only. Feedback says “Record saved”, not a decorative leaf reward. |

Landing may retain a limited four-line/three-band motif. It must neither alter the logo's internal alignment nor impose hard absolute coordinates on page elements.

On mobile, thin the graphic to at most 8 visible pinnae per side. A stage still represents the same goal records; thinning changes neither counts nor data. Below 88px, the graphic can only serve as navigation decoration alongside text. Do not make users count leaves to understand records.

### D.5 Implementation and Motion Budget

Start with one SVG skeleton and six ordinary parameter sets. One component receives colours, left/right unfolding counts, and root position. Do not build an L-system, physics simulation, plant engine, or large animation dependency. “Parametric” does not mean solving arbitrary plant growth in real time.

First accept the static forms and side mapping. Then use CSS transforms, opacity, and pre-matched local curves for transitions. Do not force continuous morphing between paths of different topology. All animation support levels must show the same final state.

Finite growth transitions last at most 900ms including staggering; an optional Landing unfolding lasts at most 1,200ms. Preserve the existing continuous resting movement without replaying seedling-to-full growth on every visit. Actions remain immediately usable. Reduced motion renders a clear static state.

The plant makes no server requests and stores no separate “level”. Derive it deterministically from merged records; synchronised devices should draw the same state. A local marker used only to prevent repeated animation is excluded from sync, scoring, and privacy exports.

---

## E. Navigation

Primary navigation is **Today / Library / Settings**. Use clean real links: `/today`, `/library`, `/settings`. First run is `/start`; sessions use `/learn/<sessionId>`. Reference paths and the dedicated `/progress` History route are listed in Product Plan 9.2. History keeps Today selected and has a back link. No Tasks/Test navigation, separate Test page or old route aliases.

Today, Library, Settings and session chrome use the standalone fern symbol at 40px, not a horizontal wordmark lockup. Complete horizontal lockups remain on Landing, About and other surfaces with room for the full wordmark; size those proportionally (around 144 desktop / 128 compact) with containers that grow with actual SVG height and wrapped labels. Mobile uses the same standalone symbol and the existing three-entry bottom navigation, minimum 64 plus safe area; top targets remain 44px. End padding accounts for the actual bar. No direction-based auto-hide.

Preserve the accepted live translucent backdrop and animated navigation underline using the current shared styles. Labels, bounds, focus and selection stay stable; reduced motion uses a static underline. Short screens, keyboards and zoom put extra fixed bars into flow rather than shrinking targets. Session pages use their own Session Bar and hide global navigation.

Do not add global single-character search/dictionary shortcuts. Optional task shortcuts remain scoped, default off, and cannot bypass Test/retained-check restrictions. Dictionary access is an explicit Library or permitted learning action.

---

## F. Page-by-Page Specifications

### 1. Landing

#### Purpose

Quickly establish that Lingfern is a reading/listening learning tool covering A1–C2 course targets, usable offline after downloading, without prior registration. The central growth fern is the brand visual, not a substitute for these explanations.

#### Layout and Visual Hierarchy

Centred composition: header → centred fern → subtle baseline → title and lead → Start learning → concise course target range. The hero has natural height; do not force 100vh, a fixed 920px, or `overflow: hidden`. Enlarged text and wrapped Chinese may extend beyond one screen.

Desktop content maximum 1120; title group maximum 720. At 1440 × 900, start with header 64, top whitespace 24, fern 280, baseline/gap approximately 40, title approximately 1–2 lines, lead 2–3 lines, main button 48, and remaining gaps 16–32. When wrapping changes, shrink the fern/whitespace first, not crop the title or button. With sufficient height, the fern may reach 360.

Visual order: fern and main title → Start learning → reading/listening/offline explanation → subsequent chapters. Loading does not wait for animation.

#### Exact Sections

**Header:** complete logo; “How it works”, “Privacy”, and a secondary “Open Lingfern” on the right. Follow the logo lockup specification. The Landing header stays in normal flow by default; do not create a second navigation that suddenly appears after scrolling. Returning users see “Continue learning”.

**Main visual:** centre the related growth fern with its root on one pale fine line. A very subtle four-line motif may echo the brand on Landing, but absolute y coordinates must not become layout dependencies. No textured or photographic background.

**Title and controls:** English may use `Read, listen, and grow into English.`; the Chinese headline conveys “Gradually understand English through real language”. Supporting copy names reading, listening, unfamiliar-material application, and no account requirement. Primary “Start learning”, secondary “See how it works”. No “understand any text” or guaranteed complete fluency.

**Course range:** “Course targets from A1 to C2”. Pair six fern forms with material targets and plain can-do descriptions, explicitly not an assessment of the visitor. Show actual content counts and disclose unavailable levels. Small graphics share root and skeleton rather than becoming six species.

**Editorial product explanation:** retain three chapters: “Real texts and audio”, “Learn, then check on new material”, and “Progress with visible evidence”. Desktop pairs left-side chapter headings with right-side text and real component examples; tablet/mobile stack them. Examples use public teaching demonstrations, never independent-check material previews.

**User-control explanation:** a definition list, not six feature cards. Cover offline after download, local saving, optional GitHub sync, external AI handoff, and privacy. Privacy copy explains that learning records are saved on the device first and sent only within confirmed scopes when sync/sharing is enabled, rather than claiming no server-side state. The offline dictionary is included; Cambridge is an explicit external link.

**Footer:** concise start entry, project source, help, privacy, sources/licences, and donation link. Display actual copyright/third-party attribution. Put build identifiers in diagnostics, not branded version badges.

#### Interaction

The primary action immediately enters First Run or Today. An optional initial subtle unfolding is allowed, but do not replay rapid A1-to-C2 growth every visit. Examples are static by default. Scrolling neither drives plant growth nor intercepts gestures.

#### Desktop / Tablet / Mobile

Desktop chapter gaps 80–96. Tablet course range 3×2 and editorial chapters single-column. Mobile gutters 20, or 16 at ≤374; fern usually 180–220, title 34/42, full-width button minimum 48. On short screens reduce the fern to 120–160 and allow scrolling rather than promising all copy fits within 88svh.

On mobile, present the six-level range as an open 2×3 arrangement instead of a horizontal strip hiding levels. Every item has clear text, without ecommerce-style cards.

#### Empty / Loading / Error

The page requires no private data and displays static content immediately. Existing local profiles get a continue entry; zero records are not a fault. If storage is restricted/unavailable, clearly state that demo records cannot be reliably retained. An unsaved demonstration is permitted, but do not silently switch to temporary storage and show “Saved”. Content downloads have actual byte progress; app-shell cache percentages do not indicate complete offline courses.

---

### 2. First Run

#### Purpose and Layout

Help users start a real task, not register for a service. No GitHub, email, or native-language collection. Desktop uses a centred 560-wide column with Back/step/Skip at the top and a 40–64 content gap. Mobile gutters 20; actions may sit at the bottom, returning to flow when space is insufficient.

Present heading, choices, Continue, and short explanation in that order. All nonessential decisions are skippable. “Try it now” from Landing may enter a short task directly rather than being blocked by a five-page survey.

#### Exact Sections

| Step | Content | Skipping and saving |
|---|---|---|
| Interface language | English, Simplified Chinese, Traditional Chinese; preselect from browser language | A valid default is enough to continue; no repeated question required |
| Purpose | Everyday life, study, work, travel, reading for pleasure/not sure | Skippable; selections support recommendations, not profile scoring |
| Interests | Five main themes: campus, daily life, popular science, humanities/culture, travel | Select 0–5; add catalogue subtopics only as real content exists |
| Starting point | Separate reading/listening choices with short A1–C2 can-do descriptions or “Not sure” | May differ and may be skipped; recommendation starting points only, not measured proficiency |
| Short demonstration | Choose reading or listening; material, example, actual questions, feedback | Estimate duration from the real task; may skip to Today |

The step indicator says “Step 2 of 5”, not proficiency progress. The demonstration takes a few minutes; do not simultaneously promise a two-minute complete flow and a three-minute task. Back preserves local selections and reopening may resume. Skipping must not penalise the growth graphic.

#### Interaction

Continue provides immediate interaction feedback, but confirms completion only after local writing succeeds. Skipping leaves a choice unspecified, not silently “B1 selected by the user”. Focus the heading on each new page. On phones, Step 4 may show reading then listening as two subsections without extra pages or a complex placement test.

After the demonstration, report actual goals attempted and next steps. Self-report and correct example answers are not independent evidence. The fern shows only a form supported by actual records.

#### Desktop / Tablet / Mobile

Desktop Continue sits at the content end, right-aligned; mobile is full-width and at least 48 high. A fixed bottom bar is acceptable at ordinary heights; with enlarged text or keyboard, return it to flow. Topic choices may wrap or form two columns, retaining 44 hit targets.

#### Empty / Loading / Error

If no suitable example exists, say so; do not start a check with placeholders. Before fetching the first audio, show actual size and verification state. Brief requests do not flash skeletons; slow downloads show real values such as “1.8 / 4.2 MiB received”. App-shell availability alone is not offline readiness.

A failed download offers retry or proceeding to Today. Insufficient storage offers storage management and cancellation while preserving selections. Without writable storage, offer only a clearly unsaved demonstration, not a fake profile or success notice.

---

### 3. Today

Today is the training hub. Keep the central fern and date/heading compact enough for actual actions; no KPI wall; preserve the existing desktop two-region composition and narrow vertical layout. Reading, Listening and Combined training (综合训练 / 綜合訓練) are the three modules. Combined appears below Listening. Preserve saved sessions when switching topics or resuming unfinished work. The maintainer-authorised Restart action is an explicit exception: visible Restart → confirmation with actual answered/total counts → clear only the current practice, then show Not started. Combined clears both paired parts atomically; cancellation and failures retain progress. Other history and profiles remain intact; recovery uses the existing backup flow.

Maintainer update (2026-10-17): the TaskDetail native backdrop interpolates blur0↔3px and its dimming colour over260ms ease, coordinated with a subtle24px drawer translation and opacity. Close-button, Escape, backdrop and browser-back dismissal retain the modal until the exit finishes. Keep native focus trapping, cancel pending entry frames on early close and provide a bounded completion fallback if transition events are absent. Reduced motion switches immediately. Keep the rounded outer frame stationary and clipped; only the full-height inner body scrolls. Light-mode desktop TaskDetail uses a restrained two-layer shadow without a solid rim. Dark mode uses one compact, low-opacity, unoffset ambient shadow and the existing raised surface; avoid an overlapping dark band along the page edge. This applies to explicit and system-following dark mode. Full-screen mobile retains the page surface and no shadow. At desktop widths (1200px and above), mouse movement outside the card or leaving the page clears blur and dimming, and returning inside restores both through the same260ms transition. At mobile widths, touch and mouse clicks, dragging and scrolling activate the backdrop only during interaction; idle hover, keyboard focus and text entry leave it clear. Close completion follows the panel opacity transition, so a pending pointer-driven backdrop transition cannot end the panel exit early. Scope this to TaskDetail; retain existing media-readiness, Practice/Test and error conditions.

Each module opens the existing `TaskDetail` material preview with equal side-by-side Practice/Test actions. Keep concise goal, estimated time and plain question-type names. Show audio provenance/duration only when audio exists; omit the no-audio row, generic replay explanation and redundant resource-size/local-installation prose. Keep media-readiness/error guards, mandatory independent-check restrictions and full source/licence attribution. Test starts answering directly without a second preview. Preview exposure is recorded and cannot become unfamiliar independent evidence.

Use a Practice heading above the three stacked cards:16px radius,16/20px padding,12px gap;20px serif title, no labels/state/info lines, real3px progress, existing topics and compact action on one row. Actual44px targets contain36px topic/40px button fills; combined narrow button wraps full width. Unknown duration is omitted. Practice uses compact pill topic triggers and the latest below-value frosted menu: checked item has a checkmark only; hover/keyboard focus has a subtle fill. Other SettingsPicker triggers, menu geometry, checkmarks and keyboard behavior remain. Mobile Daily quote appears directly below the fern, before Practice. Use one primary recommendation only when active practice has saved answers; without saved answers, all Start actions remain secondary filled. Place compact History (历史记录 / 歷史紀錄 / History) as an independent mini surface at the Practice/Reading area top right, outside every practice card, retaining a 44px hit area; it opens `/progress`. No History link beside Today’s heading, inline record expansion or Library jump beside practice. Main navigation remains three entries.

A missing/exhausted source, offline resource or failed audio has an actionable unavailable/repair state; no fabricated course/test. Database read/save errors preserve visible input and do not show success. Growth follows retained saved activity and the small capped reference contribution under Product Plan6.8; no activity means the initial fiddlehead, never self-report-derived maturity.

At 1440–320 widths retain central composition, natural wrapping and existing shared controls. Narrow/short/zoom/keyboard states remove unnecessary fixed bars. Three languages, theme/motion/focus and actual Preview→Practice/Test→save/reload/History behaviour need real checks.

### 4. Imported Tasks on Today

Any supported imported community task list is a section of Today, not `/tasks` or another main tab. Use the existing `TaskCatalogue`/`TaskDetail` paths, real metadata/resource states and existing filter/search controls only where the imported list needs them. Normal curriculum remains generated from source corpora, not a shipped authored catalogue. An empty list does not create an empty catalogue page or placeholders.

---

### 5. Learning Session

#### Purpose

Readable materials, usable responses, evidence-based feedback, and reliable local saving. The flow is goal, material, teaching/example, supported practice, feedback, and new-context application—not a question-only testing shell.

#### Layout and Visual Hierarchy

**Session Bar:** minimum 56, mobile 52. Left: Leave and the standalone 40px symbol (the same mark as the global header; do not add a second wordmark). Keep the article title in the reader. Ordinary Listening retains an accessible session title without a repeated visible heading;its material title is in Source and licence. Reading question counts/progress stay in the question panel or sheet toggle. Do not render a separate top row repeating the English skill label and question count, or duplicate these in the session bar. Mode and permitted dictionary actions stay with the question panel. Test and independent-check may show a compact mode label in the bar. AI handoff appears only after the learning task is complete, never during a check.

**Reading ≥1200:** two columns within `min(1120, viewport width minus both gutters)`. The article follows document scrolling, without its own height limit or scroll container. Answer-card height fills the available viewport from its document anchor to a16px bottom margin and stays constant during page scrolling;window resizing recalculates it. Keep the answer card sticky below the Session Bar, with an independent internal question scroll area. Do not exceed the container or hide overflow to compensate. Short screens let the card return to page flow instead of clipping controls.

**Reading <1200:** the article remains in document flow with the accepted bottom peek/expand answer sheet. Preserve page position when opening/closing the sheet or changing materials. The measured peek/expanded heights animate in both directions;reduced motion switches immediately. The initial expanded height is70% of the visible viewport. After opening, a44px drag handle continuously adjusts the height without snap points, within the visible viewport and at least24px below the actual visible Session Bar,including short/static-header states. Opening focuses the question prompt without focusing a text editor;explicit answer navigation and field selection retain their normal focus behavior. Keep square bottom corners,an inert hidden answer region and immediate focus return to the peek. Short screens and zoom remove unnecessary fixed bars instead of shrinking targets.

#### Exact Sections

**Goal and teaching:** one actionable goal before the material, necessary short explanation, and an unscored worked example. A1 copy is short and demonstrable; C2 retains needed background. Visually distinguish examples from practice; a correct example is not user performance.

**Reading material:** title 28/36, source caption, body desktop 19/32 and mobile 18/30 by default, with sans-serif and enlargement options. Paragraph gap 20. Retain emphasis, discourse structure, and direction. Wide-screen paragraph numbers may use a margin within a 32-unit budget, counted inside the container; put them inline on narrow screens.

**Dictionary and selection:** available in learning. A1/A2 may mark a small set of target words, not underline every word. Preserve drag-selection, system long-press, and copy. Do not add each word to Tab order. Keyboard users search or select text and activate an explicit lookup action. Missing pronunciation data means no fake play button.

**Listening:** follow the maintainer's2026-10-18 `lingfern-learn.zip` reference using existing tokens,actual SVG and native controls. Use a760px maximum normal page column with plain questions,no fixed side panel or enclosing answer-card surface. Source/licence opens the material title and actual attribution;Practice goal/guidance remains in a concise Before you start disclosure. The Session Bar is opaque. A56px neutral player with44px play/seek targets,explicit time and LTR seek track sticks beneath it at ordinary heights;short layout viewports return it to page flow. Remove the redundant answered-progress bar/count and permanent saved-success line;retain accessible save status and visible actionable errors. Use a plain Answer card disclosure,compact44px numbers with8px gaps and one filled current number. Both skills share concise localized Hint labels,restrained rounded inputs,and separate unchanged multiline completion instruction/source sentence typography. One-line legacy prompts remain whole. Navigation focuses stable answer-control IDs and scrolls below the player without remounting audio or resetting time. Mobile displays every question for the current recording. Transcript use remains assistance and cannot count as unaided listening.

Maintainer update (2026-10-17): new ordinary generated Practice/Test snapshots use `organization: material-v1`. Desktop Reading displays all questions for the current material in the sticky answer card while the article scrolls with the page. Mobile Reading uses the original bottom preview/expand answer card,with Material/Escape/outside closing,square bottom corners and preserved reading position;remove the inline Material/Answer switch. On mobile layouts, backdrop blur follows active clicks, dragging and scrolling inside the card for both touch and mouse;idle hover and text entry leave it clear. Desktop answer-card behavior remains unchanged. Listening shows all current-audio questions on desktop and mobile in page flow,below the thin sticky player,with no side card or repeated answered-progress bar. Both use free numbered navigation with exactly one current response and consistent44px number targets. Listening retains one audio element per material through question/card/input changes. Keep progress and per-slot answered/current state concise during answering;report group/blank/response-slot totals in the submitted review. Save drafts by stable question ID automatically;failed writes retain input and offer retry/export. One final transaction commits all answers before completion/feedback;multi-gap feedback includes each blank's answer,score and exact text/aligned-segment evidence. Goal/clue/language hints in this workspace do not reveal solutions;worked examples appear after submission. Preserve current Practice/Test assistance restrictions,unscored open responses,all original snapshots and strict independent checks. [Model and verification](docs/practice-organization.md).

Mobile reading sheets use the stable small viewport for their ordinary height, so browser-bar animation does not continually resize them. Keep the bottom anchor native; use visible-viewport compensation only for text entry or zoom. Opening focuses the prompt without summoning the keyboard. The open sheet has a44px continuous resize handle with a keyboard equivalent;internal overscroll does not scroll the passage. Measure the untransformed preview height so its smooth text enlargement cannot move the card. Close transient selection popups when the mobile visual viewport moves. Desktop behavior is unchanged.

**Questions:** explicit type and prompt. Options minimum 56 high, gap 8, natural wrapping. Use native single-choice groups; implement multiple choice, sorting, tables, and dictation as the actual plan requires rather than forcing everything into four options.

**Hints:** exactly the plan's sequence: goal reminder, clue location, language explanation. Do not silently turn layer three into automatic option elimination. An editorially reviewed special elimination hint is recorded separately, not made the global default.

**Submission and saving:** fix the submission ID and commit locally before showing results or enabling Next. While saving, `Saving…` prevents duplicate submission; failures preserve input. Explain how to answer when nothing is selected. Submit shortcuts act on the current valid form, not a page-wide Enter listener.

**Feedback:** result, text/audio evidence, why an answer is unsupported, next step. User error and the correct answer have distinct wording, symbols, and lines, not just colours. Say “Record saved”, not “Independent evidence added” for every response. Locate evidence only after an explicit action so long passages are not scrolled away automatically; focus the feedback heading in the question area.

**New-context application:** save separately from the initial practice. A goal may recur; already displayed text cannot become unfamiliar again. Review shows the first response and later correction, never overwriting the first.

**Completion:** summarise goals, assistance, and suggestions, then open review/external AI. Reviewing a check waits for its completion. Back to Today is primary, repeating the material secondary.

#### Desktop

Question panel: `bg/raised`, 1px border, shared rounded-rectangle radius, padding 24. If height permits, stick 24 below the Session Bar. Prefer natural scrolling for long panels. Use panel-internal scrolling only when needed, without controls covering content or three nested scroll containers.

#### Tablet / Mobile

Mobile Session Bar 52; Material/Question switch minimum 44; bottom action bar minimum 64 plus safe area. Do not add another persistent player layer to every small-screen state. Material view's primary action is “View question”; Question view shows Submit/Next, preventing submission without seeing the options.

Switching retains scroll/input and does not reset playback counts. “Show evidence in text” switches and locates. A return/leave route stays available.

If height is below 700, the keyboard is visible, or fixed regions occupy approximately more than one third of available height, return player, switch, and action bar to document flow, retaining only essential navigation. At still lower heights, unstick the Session Bar too. Preserve at least 320 of scrollable content space when enlarged; if impossible, stop fixing bars instead of shrinking controls to 32.

#### Keyboard / Focus

Ordinary Tab, radio arrows, space, and form semantics already complete the task. Optional number/letter shortcuts work only with the question component focused and shortcuts enabled. Do not globally intercept inputs, contenteditable, composition input, dialogs, or screen-reader browsing. D/H also check mode and scope.

Next focuses the prompt; failed saving focuses actionable error text; closing dictionary returns to the trigger. Do not combine assertive announcements for every correct response with forced focus movement and duplicate reading.

#### Empty / Loading / Error

Missing questions are content errors: return to catalogue/diagnostics, not invented answers. Unverified files cannot begin listening. Playback failure may offer transcript reading, but reclassify conditions rather than retaining standard independent-listening status.

Storage-full/transaction failure blocks completion while retaining input for retry/export. Leaving with unsaved input explains the risk; already saved work does not require repetitive meaningless confirmations.

---

### 6. Test and Retained Strict Independent Checks

Generated Test shares the learning layout, material and question snapshot, scoring, save/recovery and ordinary replay/seeking. It starts directly from the preview's Test action. Show mode and saved status; disable dictionary, hints, teaching examples, self-assessment and AI in controls, shortcuts and exports. Submission reveals no correctness/evidence until completion. Open responses are saved but unscored. No separate Test page or approved item bank.

Retained strict independent-check snapshots use their original playback, unfamiliar-root, assistance, interruption and original-device recovery constraints. No pre-start passage/transcript/clue preview for those checks; no resetting counters on remount or exporting unfinished answers. Do not impose their historical catalogue gates on generated Test.

All modes commit answers locally before Next/completion. Save/audio faults retain input/records, offer actual retry/repair/exit and never become incorrect language answers. Ending/switching to learning preserves genuine completed records and records the changed assistance conditions for later work. Completion/review may reveal permitted feedback/dictionary/AI; results are task evidence, not CEFR/examination conclusions.

Use the same natural two-column/single-column responsive layout, 44px targets, keyboard focus and short-screen flow as learning. Mode restrictions require real interaction checks, including delayed feedback, no assistance, save failure, reload and completed review.

### 7. History

History is the dedicated `/progress` record view reached from Reading top right, with Today active and a visible back link. It contains actual response/material counts, original responses or summaries, dates, support conditions, saved-session resume/review and existing deletion/recovery controls. Do not expand it inline on Today or add another growth fern, Progress navigation tab or unvalidated proficiency conclusion.

Distinguish material roots, valid responses and qualifying goals. Shared-material questions and repeated attempts do not multiply unfamiliar independent evidence. Self-report is only the chosen starting point. Assisted/answer-exposed/familiar work remains labelled with its conditions; valid faults/missing responses are not wrong answers. Word-sense FSRS and goal review schedules remain separate.

Use existing `ProgressRecords` and record controls. Any goal/level matrix or expanded list must use actual current goal metadata and readable headers/labels, not synthetic populated cells. Rows/cells have 44px targets, natural wrapping and keyboard-accessible details. Mobile uses readable lists or explicitly contained tables without whole-page horizontal overflow. Closing details restores focus.

No records shows a factual empty state. Missing original media does not erase saved responses; show actual repair/download options. Aggregation/read failure is not an empty database and must not overwrite it. Retained unfinished strict checks expose saved status only, not their answers. Deletion recomputes retained summaries rather than silently corrupting history.

---

### 8. Library

#### Purpose and Layout

A personal language library separating content, dictionary, saved items, and private notes. H1 followed by “Learning records are saved on this device first; see Settings for the sync scope”, not a claim that every displayed object is a complete local file.

Desktop maximum 1120, with Device content / Saved items / Notes / Dictionary sections. Mobile may use four tabs or section entries. Do not eagerly load every long section or present a Finder-style file tree.

#### Exact Sections

**Offline content:** estimated usage, installed packages, required resources. Example copy such as “This origin uses approximately 120 MiB; the browser estimates about 600 MiB remaining” must come from actual estimates and is not guaranteed device disk capacity. A thin proportional bar supplements readable values and cleanup controls.

Maintainer update (2026-10-17): keep the two general reading corpora and seven general audio groups inside a collapsible “General materials” subgroup under Reading and Listening respectively. Reuse the existing topic-group checkboxes, mixed selection, search expansion, installed counts and keyboard controls. Reference resources remain ordinary rows; preserve every package identity and installation state.

Package rows contain name, target range, skills, actual task count, download/expanded size, state, and one main action. Follow the plan's small-package budget, not an illustrative 180 MB package contradicting a 20 MiB publication limit.

| State | Visible action |
|---|---|
| Not installed | Download; explain connection requirement offline |
| Downloading | Actual byte progress, Cancel |
| Verifying/installing | Explicit “Verifying/Saving”, not still “Downloading” |
| Installed | View content, Details, Remove |
| Needs repair | Repair/reinstall while preserving learning records |
| Update available | Actual size of the entire new package; no delta-download promise without implementation |

Default to Cancel/Retry. Do not show Pause/Resume without real resumable downloading. Successfully installed independent packages remain when another package fails.

**Saved items:** word/phrase, simple definition, source, inclusion in word-sense review. Saving does not mean mastery; review is opt-in. Sort by recent/alphabetical, open dictionary on selection, and name the remove action clearly.

**Notes:** plain-text first line, task link, date; expand to edit with local-save state. Notes are not synchronised to GitHub by default. Do not silently create cloud notes. Markdown export is user-triggered.

**Dictionary:** search with an offline-definition/optional-Cambridge-link explanation, opening the dedicated page. Backup/restore links to the same Settings implementation, not a second import flow.

#### Interaction and Responsive Behaviour

Confirm package removal as removing course resources only, preserving records. Do not promise retained passage replay after deletion. Protect active task dependencies; one-click cleanup must not remove the current audio.

Desktop rows have title, state, and action columns. Mobile uses name, metadata, then state/actions; do not compress buttons into tiny badges. Repair progress stays inline, not a separate full-screen loader. Usable list entries remain actionable.

#### Empty / Loading / Error

No content: download through Library or import a supported ZIP. No saved items: explain saving during learning without starting FSRS automatically. No notes: explain that external AI content is not fetched automatically.

If capacity APIs are unavailable, say “Cannot estimate”, while permitting reasonable small-package installation with error handling. Distinguish missing files from hash failures and network failures. Failed imports leave the current profile intact, without automatic reset/rebuild.

---

### 9. Dictionary

#### Purpose and Three Forms

| Form | Use | Layout |
|---|---|---|
| Short popup | Quickly understand a selected word during learning without leaving the passage | Desktop around 320 wide; short, naturally sized mobile sheet |
| Drawer | More senses, search, saved items | Desktop right 420; mobile modal sheet/standalone page |
| Standalone page | Repeated searches from Library | Maximum content 720, with full navigation back |

During independent checks, menus, shortcuts, word selection, and automatic calls must not bypass dictionary restrictions. Learning permits explicit lookup of all words without placing every word in Tab order.

#### Popup

`bg/raised`, shared rounded-rectangle radius, padding 20, popover shadow. Prefer 8 below the triggering word, moving above or becoming a sheet if space is insufficient. Show headword 22/28, available IPA/audio, part of speech, relevant simple meaning, one licensed example, Save, More.

**Show only available data:** no empty play buttons for missing UK/US audio, IPA, examples, or collocations; no guessed pronunciation. Prefer editorially mapped course senses. Without mappings, identify candidates rather than treating spelling similarity as successful disambiguation.

#### Drawer / Standalone Page

Search at top, headword 32/40, source, and part of speech. Course definitions first, with simple English explanations/examples for A1/A2. Collocations appear as short lines, not decorative chips. More senses is a collapsed Open English WordNet section showing definitions, synonyms, broader/narrower/opposite relations in text—not a semantic-graph engine.

After a divider, provide **“View in Cambridge Dictionary ↗”**. Open the official online page only on explicit selection. No prefetch, iframe, HTML proxy, hotlinked pronunciation, or silent definition caching. Online failure preserves local lookup. Use safe external-link behaviour and send only the chosen word/phrase, not passage, answer, or account details.

Build links from a fixed official destination and encoded query; test the actual URL, never accept arbitrary URLs. Connectivity state is a hint: `navigator.onLine` does not establish “Cambridge connected”. Explain the network requirement offline while local definitions remain usable. No in-app Cambridge data tab without formal API authorisation.

#### Interaction

A nonmodal desktop dictionary drawer does not dim the entire page and allows return to the material. If insufficient width remains, use a modal or standalone page; do not obscure the question while claiming the two-column interface remains usable. Focus enters the actual popup controls and returns to the trigger on close; lookup must not depend on hover.

Mobile sheets have a visible 44-hit-target close control and Back/Esc support. Dragging is optional. With the software keyboard, search/results remain scrollable; do not insist on fixed 92vh and hide Close. The latest 5 queries stay local and do not reappear from the cloud after clearing.

#### Empty / Loading / Error

No entry: explain that the offline dictionary does not include it yet, with actual existing spelling suggestions and a Cambridge link. Search suggestions do not score answers. If WordNet is not ready, show the course layer first and accurately name the unavailable part.

Corrupt dictionary data offers repair. Pronunciation failure and missing definitions are separate and do not block reading. Community/AI entries retain their sources, not automatic Cambridge/WordNet attribution.

---

### 10. GitHub Sync

#### Purpose and Location

Settings → GitHub sync. The main interface shows local saving, pending sync, and last success, not Git mechanics. The consent screen must still accurately explain read/write access to the selected repository.

#### Layout

Maximum 560. Connect account → choose dedicated private repository → confirm sync scope. The overview is an open list, with bordered sections only for exceptions. Mobile stacks content; targets remain at least 44.

#### States and Interaction

GitHub and MCP reuse the setting rows and theme tokens. Unbound repositories show the setup steps;bound repositories put them in Set up again. Repository rows remain flat,52px high with regular15px text,without a second inherited section border. Use one divider per boundary and regular-weight footer actions. Expanded MCP lists use quiet subheadings and empty text,with no trailing empty divider. Keep actual account/profile choice,repository verification,expiry,CSRF,confirmation and independent sign-out/disconnect/revoke actions intact.

| State | Page and action |
|---|---|
| Signed out | Explain optional sync and offer “Connect GitHub”. Learning remains available; do not start login just to populate header status. |
| Authorising | User visits official GitHub pages; return shows the account from the real session. Allow cancellation on timeout, without redirect loops. |
| No repository bound | External “Create a dedicated private repository on GitHub” plus steps. User creates it manually, authorises only that repository, then returns and refreshes selection. **Do not fake one-click repository creation inside Lingfern.** |
| Binding confirmation | Account, selected repository, privacy-verification result, and fields to sync. Upload a guest profile only after confirmation. |
| Initial sync | Validated batch/record counts; no fabricated percentage with an unknown total. |
| Synced | Last server-confirmed time, separate from local saving; manual sync available. |
| Pending/offline | Saved locally, not yet received remotely; retry in the foreground when connectivity and authorisation permit. |
| Reauthorisation needed | Explain expired remote permission without inferring lost local data; reconnect remains optional. |
| Conflict | Explain that a batch is not merged and local data is retained. Offer retry, diagnostic export, backup—not whole-device overwrite. |

Describe real data flow: learning summaries enter the user's dedicated private repository; the server retains necessary identity, session, binding, and approved expiring-share state. **Do not say “Lingfern has no server-side data” or “Only you can see the repository”.**

#### Conflict Scope

Current sync excludes notes, essays, and private text. Do not make “one note edited on two devices” a primary workflow. Settings/saved items merge by the plan's logical ordering. Same event ID/different content, wrong profile owner, and repository-format mismatch need attention.

The conflict panel describes affected scope/actions without exposing entire private payloads. Format conflicts cannot be resolved by bulk “Use other device” or force push. Only design a keep-both text comparison if free-text sync is genuinely added later.

#### Sign-Out and Disconnection

Three independent operations:

- **Sign out on this device:** end the web session, optionally clear this device's records; repository remains.
- **Disconnect sync repository:** remove binding and stop uploads; do not automatically revoke other AI connections.
- **Disconnect GitHub identity:** revoke related sessions, remote grants, and expiring shares as the plan specifies, explaining the separate GitHub installation-revocation scope.

Each confirmation names its scope. One generic `Disconnect` must not conceal three different consequences.

#### Empty / Loading / Error

Stop private uploads if a repository becomes public, ownership is wrong, or permission is revoked. Show retry timing for rate limits. If GitHub is unreachable, users can return to local learning/backup. State only known outcomes, not absolute safety of provider history, copies, or device storage.

---

### 11. AI Sharing

#### Purpose and Entry

Offer “Ask AI” only after task completion and permitted feedback disclosure. During unfinished independent checks, disable buttons, shortcuts, exports, and temporary sharing. Submitting one question must not leak later questions on the same material.

Do not keep an answer-revealing chat entry in the active Session Bar. Completion/review pages use a sharing arrow and text, not an assistant avatar, magic wand, or model selector.

#### Layout and Sequence

Desktop: 520-wide modal drawer. Mobile: full-screen or up to 92dvh sheet. With a virtual keyboard, let content scroll naturally and keep confirmation from covering input.

1. H2: “What will be shared”.
2. Explain separately: copy/download produces a local handoff; sharing with a connected assistant uploads a selected small snapshot to Lingfern for an approved client to read. Do not generalise this as “Lingfern does not communicate with AI”.
3. Selectable content: necessary original text/transcript, task, current response, permitted feedback, goal summary. Do not include private notes/responses automatically; explicit selection shows the full preview.
4. Four ordinary requests: explain an error, give another example, comment on a summary, suggest next practice. Retain free-question input, not a prompt-engineering workbench.
5. Preview: readable prose by default, expandable technical Markdown/JSON. Identify source, word count, and excerpts; no silent truncation of long materials.
6. Actions: copy text, download Markdown/JSON, system sharing. Fall back to manual copying/downloading when capabilities are missing.
7. Separate “Make available to a connected assistant” section: actual client, upload scope, default 24-hour expiry, and revocation control; execute only after confirmation.

#### MCP States

Signed out: explain that remote sharing requires GitHub identity, not a sync repository. Local copying remains available.

No authorised client: open connection guidance in Settings with copyable `https://lingfern.com/mcp`. Authorised: list the user's actual clients, not “all MCP clients” as a default audience.

Snapshot creation: at most 32 KiB each and 20 active snapshots per user, validated under the plan. If exceeded, ask for an excerpt or deletion of previous shares. After success show the actual snapshot and expiry. Revocation blocks future reads, not copies already inside external conversations.

#### Feedback Import

Pasted text becomes a local note. Structured JSON up to 64 KiB is validated and kept as a draft. Preview proposed exercises/goals and require confirmation. Do not change original answers, scores, content review, or calibration status.

#### Accessibility and States

Copy success means clipboard success, not delivery to ChatGPT/Claude. Download is not upload. Cancelled system sharing is not success. Failed MCP snapshot creation must not show availability; protocol connection and access to a particular snapshot are separately tested.

Modal drawers trap focus and restore it on close. Large previews allow keyboard scrolling; privacy fields have clear labels. Failures offer retry or local handoff, not automatic switching to another service.

---

### 12. Settings

#### Purpose and Layout

Desktop: left section index 200–220, right content maximum 560, gap 48. Mobile: section index opens subpages, retaining “Back to Settings”. Rows use dividers and minimum height 64, growing with enlarged text.

#### Settings

| Group | Controls and behaviour |
|---|---|
| Interface language | Simplified Chinese, Traditional Chinese, English, Japanese, Korean, French, Spanish, German, Portuguese, Italian, Russian, Arabic, Hindi and Indonesian; independent packages under `src/locales/`. No native-language or reading-translation requirement. |
| Appearance | Light/Dark/System; serif/sans-serif reading; presets 18, 20, 22, 24; browser enlargement remains unrestricted. |
| Reading support | Show/hide vocabulary markers during learning; display only, not item difficulty/scoring changes; off in checks according to conditions. |
| Motion | System/Reduce motion. Do not default to forced large motion when the system requests reduction. |
| Keyboard | Task shortcuts off/on, off by default; explain scope and disabling. |
| Offline content | Storage estimate and management; show size and confirm download. Do not promise reliable mobile-data detection or unenforceable “Wi-Fi only”. |
| GitHub sync | Identity, selected repository, actual state, and separate sign-out/sync-disconnection/identity-disconnection controls. |
| AI connections | Authorised clients, temporary shares, expiry, revocation; no third-party chat credentials. |
| Backup | Ordinary ZIP export/encrypted backup when implemented, restore, last backup. Optional reminders when the app opens, no email/background service. |
| Privacy | Actual data flow, sharing scope, research export, deletion; not “Everything stays local forever”. |
| About | Always English, with its own copy in `src/app/aboutCopy.ts` outside display-language packages and explicit `lang="en" dir="ltr"`. Settings entry and surrounding navigation remain localized. Lingfern source link, actual licences, third-party attribution; build information in collapsed diagnostics, not branded version headings. |

Network Information API availability is limited; automatic Wi-Fi/cellular detection cannot be promised across browsers and requires capability detection.[UI4]

#### Deletion and Backup

Course removal deletes redownloadable resources, not progress. Before clearing device records, list scope and offer backup. Explain that remote copies are unaffected for synced users, and the risk to local-only records for unsynced users.

Revoking shares, signing out, deleting learning records, and erasing remote Git history are separate. Destructive actions need explicit confirmation. Cancel/Esc retain data; no toast suggesting an irreversible action already completed when it did not.

#### Desktop / Tablet / Mobile

On narrow screens, stack labels and controls. Toggles may remain inline if targets suffice. Long mobile settings use normal scrolling, not two nested focus-trapping sheets.

#### Empty / Loading / Error

Temporary defaults may render after a settings-read failure, with an explicit warning. Do not immediately write defaults over the database or sync them remotely. Validate restoration before modifying the current profile, and show completion only after a successful transaction.

---

## G. Components

### G.1 Buttons

| Type | Default | Hover/press | Use |
|---|---|---|---|
| Primary | Brand fill, on-accent text, weight 600 | One/two darker steps; no layout movement | Main action in current decision area |
| Secondary | Transparent, control border, body text | Sunken fill | Review, inspect, secondary action |
| Ghost | No border, dark sage text | Pale sage fill | Back, skip, expand |
| Destructive | Dark error fill, light text, explicit verb | Darker step | Confirmed deletion |
| Secondary destructive | Error text/border, no large red fill | Pale error fill | Open deletion confirmation |
| Icon | Icon around 20, hit target 44 or 48 | Sunken fill | Settings, close, player menu |

Large buttons 48 high, standard 44, primary touch actions may use 52. Horizontal padding 28/20, shared rounded-rectangle radius. Compact desktop buttons may look 36 high but still have nonoverlapping 44 hit targets. All heights become minima with enlarged text.

Unified focus 2px ring + 2px gap. Keep width during loading, with specific verbs such as “Saving”/“Connecting”. Sync success requires confirmation. Disabled states explain why, not only grey colour. Reject duplicate submissions during saving while retaining accessible status.

### G.2 Text Links

Body links have underlines and dark sage text; hover deepens colour without movement. Standalone navigation links may omit default underlines, but focus is always visible. External links have ↗ and an “Opens in a new tab” accessible name, accessing the destination only on user action. Pale underlines are decorative; link identity remains distinguishable from surrounding text.

### G.3 Containers and Task Items

**Panels:** questions, players, and feedback may use `bg/raised`, 1px border, shared rounded-rectangle radius, padding 24/20. Lists/settings use fine dividers, not cards everywhere for component consistency. Shadows are for overlays only.

**Task rows:** minimum 88 high, vertical padding 20; level column around 56, flexible title/metadata, status area around 120. Switch three columns to vertical flow when space is insufficient; do not truncate essential mode/resource information. The row link is focusable. Additional buttons require separate semantic targets, not nested interactive elements. Completion does not reduce body-text opacity.

“Downloaded”, “12 MiB download required”, and “Completed” have text/icons. Counts come from the catalogue. Truncated titles remain fully readable in details.

### G.4 Levels, Labels, and Records

**Material level:** monospace 13/18, muted grey-green, no rainbow palette. Include “Target material” or a clear column heading; it is not an attained user level.

**Level selection:** each A1–C2 segment has an effective 44 target and may wrap. Selected fill and tick work together; no six-step “achieved level” ladder. Personal progress has no unvalidated score or confidence track.

**Record rows/cells:** use F.7's condition symbols plus counts and material dates. Up to 5 marks are a preview, not one original observation per leaf. Give cells complete accessible names and clickable full-cell targets, not 8px dots.

### G.5 Tabs and Segmented Controls

Tabs switch peer content within a page: minimum 44 high, gap 24, 2px selected underline, 1px parent rule. Implement arrows/Home/End according to control semantics; ordinary page links remain links, not false tabs.

Segmented controls are single-choice views/filters, height 44, inner padding 2, shared rounded-rectangle radius. Selected segment uses charcoal with light text, unselected hover a sunken fill. Do not use one control as both multi-select and a single-choice group.

Overflow may scroll within the component on mobile, preserving full accessible labels and scrolling focused choices into view. Too many filters belong behind a clearly named Filters control, not an endless chip strip.

### G.6 Filter Chips

Visual height 36–40, effective target 44, horizontal padding 14, pill shape. Selection uses a tick and dark 2px inset border, not pale green alone. Removal × also has an effective 44 target; no tiny 32px button cramped against other targets. Read-only topics are metadata, not apparently interactive chips.

### G.7 Audio Player

Minimum height desktop 72/mobile 64; main circular play button 44–48 with at least 8–10 surrounding space. One primary playback source at a time. Pause task audio according to policy before dictionary audio begins; checks must not bypass restrictions through pronunciation entries.

| Element | Learning | Generated Test / retained strict check |
|---|---|---|
| Play/pause | Explicit button according to task state | Test: ordinary controls; retained check: saved playback policy |
| Time/duration | Tabular figures | Same |
| Progress | Draggable with keyboard/jump alternative | Test: seeking allowed; retained check: only when its policy permits |
| Replay/back | Segment repetition, optional 5-second back | Test: ordinary replay; retained check: hide prohibited controls/shortcuts |
| Speed | Initial menu 0.75, 0.9, 1.0, 1.25, adjustable by product | Locked to specified conditions with explanation |
| Transcript | Explicit reveal, assistance recorded | No early disclosure; post-check review or explicitly selected accommodation |
| Play count | Actual playback record | No invented global play limit; retained checks show their actual saved allowance |

Mobile retains play, time/progress, and More, with other actions in the menu. Short screens return the player to flow rather than a 32-high control strip. Touch slider handles remain visible, not hover-only. Read-only progress has no slider role or dragging.

Playback failure has text, retry, and exit, not a language penalty. Audio/transcript align by sentence. Do not force-scroll while the user reads; offer follow/stop following.

### G.8 Questions and Answers

Question number/mode uses Caption; prompt 17–18 with line-height 26–28; instructions use clear English or interface help. Implement information selection, multiple selection, sorting, evidence location, tables, and dictation as specified. Sorting needs movement buttons and keyboard access.

Options minimum 56 high, padding 14×16, shared rounded-rectangle radius, letter marker around 28, text gap 12, body 16/24, option gap 8. The entire option is the selection target; the letter circle is not a duplicate button.

| State | Presentation |
|---|---|
| Default | Control border, transparent fill |
| Hover | Sunken fill, no elevation |
| Focus | Standard focus ring |
| Selected | 2px brand inset border, pale green, filled letter marker, selected state |
| User correct | Dark success border/light fill, ✓ + “Your answer / Correct” |
| User incorrect | Dark error border/light fill, × + “Your answer” |
| Correct answer revealed | Dark dashed success border, ✓ + “Correct answer” |
| Other locked options | Immutable but readable, not low opacity alone |

Check submissions show only selected state and “Answer saved”, not early correctness colours/icons. A failed save must not lock the response as submitted or let Next bypass the failed transaction.

### G.9 Hints and Feedback

Default hints: **goal reminder → clue location → language explanation**. Trigger: “Need a hint? 0/3 used”, with counts from the actual task and no fake buttons for absent layers. Use a 2px dark/pale sage left rule, padding 12×16, short label, and body. Announce new content politely. Layer three is not automatic global option elimination.

Feedback order: **result → evidence → explanation → next step**. A semantic top edge is allowed, with text for every result. Show evidence only when permitted, with source/time location. Explain unsupported answers without inferring personality or overall language ability. One Next button shared with the action area.

Ordinary feedback says “Record saved”. Show independent-completion records in summaries only when the plan's conditions are met; shared-passage items are not automatically statistically independent.

### G.10 Dictionary Overlays

Popup 320, drawer 420, standalone page 720; see F.9 for complete behaviour. Play controls require real audio. Saving uses a bookmark/text; word-sense review is a separate opt-in action. A Save animation is not a learning result.

### G.11 Modals, Drawers, and Sheets

Modal widths 440/560/720, padding 32 desktop/24 mobile, shared rounded-rectangle radius. Light-mode backdrop around rgba(23,27,24,.40), no blur. Heading 24/32, body 16/26, action gap 12. Destructive confirmations state actual scope; Esc equals Cancel.

Modal layers trap focus and block background interaction. Nonmodal dictionaries do neither and retain readable material. Drawers 420/520, full-height scrollable content, 44 close target in header. Insufficient width means modal sheet or standalone page.

Mobile sheets may reach 92% of available viewport, with optional dragging and visible Close. Do not insist on fixed height/bottom actions with keyboard or zoom. Button order follows reading/action logic; mobile must not make a destructive action the default.

### G.12 Toasts and System States

Toasts confirm nonblocking actions, desktop 24 from bottom, mobile 12 above fixed bars. Maximum width 440, padding 12×16, shared rounded-rectangle radius. Approximately 5 seconds, or 8 with an action; pause on hover/focus. Important actions also exist on the page. New toasts must not replace errors requiring attention.

Light theme: charcoal toast with warm-white text. Dark theme: warm-white toast with charcoal text. Links must also be readable; do not retain light-green text on warm white. Copy feedback may say “Copied”, not “Sent to AI”.

**Sync:** disabled, synced, pending, syncing, needs attention, and expired permission have distinct text/icons. Header icons have 44 targets. Do not animate without an actual request. Last-sync time uses real confirmation only.

**Offline:** neutral. Say downloaded learning is available only when installed resources actually work. Uninstalled actions explain connectivity needs. Local-save failures are not offline failures. On network recovery, request sync only when enabled with genuinely pending data.

### G.13 Empty, Slow, and Failed States

Left-align empty states with actual next actions; no invented courses or redundant explanatory prose. The growth plant belongs to Today/Landing, not generic empty states or History.

Usually no placeholder before 300ms, but action buttons respond immediately. After 300ms use static skeletons; measurable downloads show actual bytes/files, not invented percentages. Loading, no records, and read failure differ.

Errors may be inline, sectional, or page-wide, with known facts and executable actions. Save failures retain input. Failed aggregation does not become an empty database. Do not guarantee data is intact when unknown. Retry, export, return, and repair must correspond to implemented behaviour.

---

## H. Responsive Rules

Use both available content width and height, not device names. Include enlarged text, long Chinese copy, safe areas, browser chrome, and software keyboards in layout calculations.

| Width | Gutter | Navigation | Learning page | Other main changes |
|---|---:|---|---|---|
| ≥1440 | 64 | Complete horizontal mark, 64-high header | 640 + 48 + 432 = 1120 | Today: small central fern/one task; History stays focused on record lists |
| 1200–1439 | 48 | Complete or compact horizontal mark | 640 + 48 + remaining questions; 416 at 1200 | Obey available width; do not overflow by adding incompatible column minima |
| 768–1199 | 32 | Compact mark; three-entry bottom navigation if labels do not fit | Single column maximum 640, optional Material/Question switch | Filters move above; History lists stack |
| 375–767 | 20 | Standalone symbol in mobile header 56 + bottom bar 64 | Single column; normal heights may use switch 44/action bar 64 | Smaller plant, taller task rows, Settings sections → subpages |
| 320–374 | 16 | Standalone symbol preferred | Natural flow preferred; long words may wrap | No forced 45ch minimum or full-page overflow from filters |

**Height:** below 700, with keyboard, or when fixed regions exceed roughly one third of available height, progressively unstick player → switch → bottom action. If still insufficient, return Session Bar to flow. Do not keep a larger plant/header by shrinking primary hit targets to 32.

**Landing:** natural content height; CTA does not wait for animation. Typical desktop plant 280–320, reduced on short screens; mobile 180–220, short screen may use 160. Six course targets form 2×3 on mobile, not hidden in a strip whose scrolling users must guess.

**Today:** central plant at every width, mobile 96–120. Main task maximum 800, left-aligned text, unfinished work prioritised. Aim to show the primary action in the first screen at default size on a common 375×812 display. Large text and 320×640 may scroll; do not shrink text to satisfy a rigid target.

**History:** record counts, support conditions and session links stay readable; expanded tables scroll within their container, not the whole page.

**Library:** name, state, action change from three columns to three rows. Mobile drawers may become standalone pages; not every dialog must slide from the bottom.

**Fixed-region measurement:** use actual rendered heights, not hard-coded `top: 56` everywhere. Buttons/navigation/options use minimum heights and grow with text. Anchor/focus scrolling avoids the actual fixed areas.

---

## I. Dark Theme

### I.1 Main Surfaces and Controls

Section C defines base colours. Dark mode is not an inversion filter: body text sits on the page background, players/questions on raised surfaces, and genuine overlays on `#262C27`. Do not place whole passages inside bright cards.

Reading text is `#E3E8E1`, primary UI text `#EBEFE9`. Retain line-height and weight rather than making everything bold for clarity. Control border `#778177` retains distinction on overlays. `#333B35` is a normal divider, not a substitute for every essential boundary.

Primary buttons use light sage `#A4B99F` with charcoal `#171B18`; hover darkens to `#90A589`. Secondary buttons use a subdued solid fill, never an outline-only capsule. Selection fill `#26342A`; keyboard focus retains a visible outer ring. Test actual pages.

### I.2 Semantics and Evidence

| State | Text/icons | Background | Identifying border |
|---|---|---|---|
| Success/correct | `#8FC7A0` | `#1B2B20` | `#7BAA89` |
| Error | `#E59A88` | `#36201C` | `#C48373` |
| Warning | `#DDB86A` | `#332A18` | `#B19759` |
| Information | `#9AB9CC` | `#1B2730` | `#809FB2` |
| Material evidence | Body text colour | `#3A3420` | Annotation `#C9A659` |

Keep wording, symbols, and solid/dashed distinctions. Dim borders/colour alone do not replace readable state labels. Theme never changes correctness.

### I.3 Logo and Plant

Use `public/icon.svg` directly or as a CSS mask in the theme accent colour. Preserve its geometry; light and dark themes use this same version. The 192px and 512px PNG installation icons are required derivatives, not alternate designs.

Growth fern may use rachis `#8FA58B`, mature pinnae `#A4B99F`, new leaves `#6E8570`. Low-contrast new-leaf portions are decorative transition only; important record states require clear outlines/text. Missing records are not glowing gaps.

### I.4 Overlays, Images, and Theme Switching

Overlays use background plus 1px divider, without heavy shadows/glow. Backdrop may be rgba(0,0,0,.55); modal semantics still distinguish menus from the background. Toasts reverse to a light surface with dark text and links.

Do not automatically darken teaching photographs/diagrams by 8%. Colour or brightness may be material information; changes require content-asset permission. No global inversion of external assets. Provide an unchanged background container and explanation where necessary.

A short colour transition is permitted; reduced motion switches immediately. System is the default theme, overridden by explicit user choice. Switching themes must not redownload courses, refresh the page, or interrupt playback.

---

## J. Motion

| Situation | Trigger | Duration and method | Reduced motion |
|---|---|---|---|
| Landing plant | Optional initial display after page/action readiness | Total ≤1200ms; partial unfolding, not necessarily smallest-to-largest | Static |
| Personal growth | New qualifying goals change form after successful aggregation | Total ≤900ms including stagger; new portions only | Static plus change text |
| Route change | Navigation | Approximately 140–220ms fade; optional movement ≤8px | Direct display |
| Option selection | User choice | 140ms colour/border, no scale | Direct switch |
| Submission feedback | Successful local transaction | 220–360ms expansion/fade | Direct display, normal focus |
| Hint | Request next layer | 220ms expansion | Direct display |
| Drawer/modal | User opens/closes | 220–360ms, ease-out without spring | Direct switch |
| Evidence location | Explicit link | Optional smooth scroll approximately 360ms | Direct positioning |
| Hover/press | Pointer/keyboard | Existing small underline/colour motion, no unstable control bounds | Clear static state |
| Download progress | Actual bytes received | No fictitious automatic advance; short transition if needed | Immediate actual values |
| Sync | Real request underway | Static opposing arrows and text suffice; looping not required | Same |

Use ordinary ease-out, for example cubic-bezier(0.2,0,0,1); the plant may use cubic-bezier(0.33,0,0.15,1). These describe timing, not a need for an animation library.

Honour system reduced-motion requests. The app may additionally reduce motion, but must not override the system by default and force playback. No particles, scroll-jacking, reward confetti or mandatory transitions. Existing fern/resting motion and translucent underlines remain light and purposeful, with a static reduced-motion state.

Cancelling animation does not cancel saving, reset playback, or lose focus. Determine data and graphic state before choosing to animate, never infer learning state from animation-completed events.

---

## K. Accessibility and Usage Conditions

### K.1 Contrast and Reading

Target body contrast 4.5:1, checking larger text and significant controls/states under applicable requirements; identifying non-text boundaries generally target 3:1. Decorative dividers need not all be darkened to meet control thresholds. Do not round a failing ratio upwards into a pass. Check actual backgrounds, alpha, fonts, and focus.[UI1][UI2]

Provide system fonts, enlarged reading text, and serif/sans-serif selection. At 200% text and 400% page zoom, important content remains uncropped. Necessary two-dimensional content such as tables may scroll in explicit containers; passages must reflow.

### K.2 Keyboard and Focus

All tasks work with standard Tab, forms, radio arrows, and button space activation. Single-character shortcuts must be disableable/remappable or active only while the relevant component has focus. Checking only “not in an input” is not comprehensive shortcut compliance.[UI3]

Optional single-character shortcuts are off by default. When enabled, verify mode, component focus, input method, dialogs, and editing state. Global search, task search, and dictionary must not compete for `/`. D/H in checks cannot bypass dictionary/hint restrictions.

Each page has Skip to main content, one H1, and ordered headings. Modals trap focus, Esc cancels, and closure returns to the trigger. Nonmodal dictionary allows return to the passage without lost focus. Reserve actual sticky-region scroll spacing; focused controls must not be obscured.

### K.3 Screen Readers

Use genuine HTML for passages, tasks, and sources, not Canvas. Label Chinese interface and English materials separately. Questions use forms, fieldsets, and labels. After submission, options add actual states such as “Your answer/Correct answer”.

Hide decorative plants from assistive technology. Personal plants have a brief alternative description and complete adjacent text. No separate Tab stops or lengthy names for 24 leaves. Matrices use real headers; expanded mobile lists retain goal/level/condition relationships.

Evidence may use semantic mark with a purpose label. Unrevealed answers must not appear early in aria attributes. Dictionary access must coexist with selection without hundreds of word-level keyboard stops.

### K.4 States, Errors, and Timing

Announce success only after saving. Ordinary changes are polite. Use assertive only for urgent errors genuinely blocking action, not repeated interruptions for a wrong answer. Avoid duplicate reading of the same long passage through focus movement and live regions.

Errors remain findable. Toasts confirm; undo also exists in its list/settings rather than only an 8-second window. Pause toast expiry on dwell/hover. Distinguish download, sync, playback, and database errors without guarantees about unverified data safety.

### K.5 Touch and Small Screens

Minimum target 44×44, primary actions 48–52. Visual icons may be smaller, but hit areas do not overlap. Sorting has movement buttons/keyboard alternatives; sheets have visible Close; audio sliders have keyboard and precise seek alternatives only if the current mode allows them.

Reduce fixed bars before shrinking text/controls or hiding materials. Account for safe areas and keyboard. At enlarged sizes, require complete scrollable content, understandable states, and reachable actions—not compulsory visibility of both result and evidence in one screen.

### K.6 Audio and Checks

Learning may show existing verified transcripts. Checks follow explicit material support conditions. Explain transcript accommodations beforehand and record them separately from standard audio conditions. They are not cheating and not unaided listening evidence. Review after completing a check, not answer leakage after each question sharing a material.

Every audio control has a text name. Playback is not automatic. Pronunciation controls require actual files and permission. Missing/undecodable audio is not a language error.

### K.7 Three Languages and Validation

Maintainer update (2026-10-16): B1–C2 instructional goals, before-start guidance, worked examples, hints, explanations and next steps use English in every interface language, including previously saved lessons. General navigation/actions use fourteen interface packages (maintainer update 2026-10-17). A1–A2 reviewed instructional support uses the selected language in all fourteen packages; the eleven non-Chinese/English languages each own `teaching.json`. Arabic UI uses RTL while English material, answers and instructions retain LTR. Unknown private/older instructional text also falls back to English with its actual language tag. Select the display language without rewriting saved learning snapshots.

All fourteen languages include privacy, errors, authorisation, fern legends, and empty states—not navigation only. Review Traditional Chinese properly, not mechanical conversion. A1 users may choose any interface language; do not assume a Chinese native language. Teaching still includes simple English/examples rather than relying on online AI for beginner support.

Automated checks do not establish full WCAG compliance. Test keyboard, screen readers, zoom, touch, and real-phone audio. Mark untested devices/assistive technologies explicitly.

---

## L. Current Surface Structure

These are placement guides, not synthetic learner data or runtime acceptance:

```text
Today / Library / Settings navigation
Today: date + central fern + 今日 heading
  Reading                                  History
    Start/Continue → shared preview → Practice | Test
  Listening
    Start/Continue → shared preview → Practice | Test
  Combined training
    Start/Continue → shared preview → Practice | Test
History: Back to Today → counts / conditions / records / saved-session links
Learning/Test: Session Bar → material + questions → transactional save → permitted feedback
Library: lookup history / dictionary / IPA / usage / import / downloads / installed resources
Settings: shared pickers / identity-sync-sharing / backup-privacy / updates / About
```

Two learning columns start at 1200 when actual available width permits; narrow/short/keyboard/zoom states use natural flow and reachable 44px controls. Layout uses existing tokens and complete SVG lockups. There is no Tasks/Test navigation or second History fern.

---

## M. Implementation Decisions and Acceptance

### M.1 Current Component Reuse

Reuse `SettingsPicker`, `TaskDetail`, `OnlineLookup`, `PlaybackIcon`, `.primary`/`.button`, `.option` and shared text-entry focus; colours/surfaces/radii come from `public/ui-tokens.css` and `src/app/style.css`. Inspect callers before extending a shared component. Intentional differences follow function, such as audio timelines/autocomplete, not the owning page. No cosmetic dependency or design framework.

### M.2 Copy and Operational States

Use restrained labels/actions. Retain concise actionable save/error/deletion/authorisation/backup information and source licences, without repeatedly promoting original/local/authentic content or implementation status. Empty update status stays hidden; actual status takes its natural text height, without fixed blank reservations. Preserve accepted backdrop/underline/fern motion, focus, disabled and selected states.


### M.3 Most Likely Failure Points

**The plant is mistaken for a proficiency level.** Explain course illustrations and personal progress differently. Personal pages do not label six forms as A1–C2 advancement. Independent-goal records remain traceable. Screenshot copy also describes target materials, without “Share my level” cards.

**The plant returns to a corner or overwhelms tasks.** Check centred composition on Landing and Today while limiting actual height. First-screen tasks/actions have priority. Learning has no decorative fern.

**Interaction appearance precedes real functionality.** Lists, percentages, dictionary audio, confidence, and sync success require data. No playback success without audio, connection success without APIs, or course cards without courses.

**Multiple fixed mobile bars crowd content.** Test 320×640, 375×812, landscape, and keyboard states. Return to flow when needed; do not add another 32-high toolbar.

**Visual copy rewrites functional rules.** Recheck hint sequence, test previews, dictionary conditions, copying/uploading, sign-out/disconnection, and failed saving every time. “The draft designed it this way” is not a reason to broaden permissions or scoring scope.

### M.4 Implementation Order

1. Reuse existing logo/tokens/components and current Today, Learning/Test, History, Library/reference and Settings surfaces.
2. Test six forms and side mapping against static synthetic records, then real local records. Do not mix synthetic records into production profiles.
3. Complete actual History, Library, sync and AI states. Unconfigured remote functionality says disabled/unconfigured honestly.
4. Add necessary short transitions, then test system reduced motion, narrow screens, screen readers, and complex failures.

Do not create another design framework, UI tool platform, or plant simulation engine. Reuse accessible base controls where appropriate, choosing dependencies under the plan rather than adding a separate library for each overlay.

### M.5 Delivery Checklist

| Dimension | Required checks |
|---|---|
| Surfaces | Landing/First Run, Today, Learning/Test, History, Library/references and Settings identity/sync/sharing/backup/privacy/update/About |
| Brand | Proportional lockups, complete g/f descenders; no changes to paths, weight, four-line alignment |
| Layout | Widths 1440, 1200, 1024, 768, 375, 320 and short 640-high screens; no whole-page horizontal text overflow |
| Themes | Light, dark, system; identifying-control contrast on panels and overlays |
| Input | Keyboard, touch, Chinese IME, software keyboard; optional shortcuts cannot bypass check permissions |
| Zoom | 200% text, 400% page; reasonable scrolling, no important cropping or target compression |
| Plant | Zero records, self-reported C2, asymmetric records, repeated materials, hints, sync deduplication, deletion recalculation |
| Modes | Shared-preview generated Test, no second preview/assistance/early feedback; retained strict checks keep no-preview/unfamiliar-root/recovery conditions |
| Data | No advancement before save success; local/pending/remote-confirmed states distinguishable |
| Sync | Official creation guidance, binding validation, conflict isolation, distinct sign-out/disconnection |
| Sharing | Copy/download local; MCP upload scope/client/expiry explicit; revocation does not falsely recall external copies |
| Dictionary | Missing entries/IPA/audio, unreachable Cambridge, offline queries have truthful states |
| Content | All three languages, understandable A1, C2 not reduced to obscure vocabulary; sample numbers not actual results |

Design calculations and document consistency checks are not runtime UI testing. Codex reports actual browsers, devices, build commits, and results, marking untested content accordingly. Wireframes do not replace screenshots or real behaviour.

### Sources Used for Checks

Visual/component foundations come from the user-supplied Lingfern written UI/UX design; product behaviour from this package's [Product Plan](Product_Plan.md); branding from [Logo Usage](docs/brand-assets.md). Rearrangement, display thresholds, and failure interactions in this document are explicit integration suggestions.

- [UI1] W3C, text contrast thresholds/calculation: [Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [UI2] W3C, essential non-text controls/state contrast: [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- [UI3] W3C, disabling/remapping/component-focus requirements for single-character shortcuts: [Character Key Shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html).
- [UI4] MDN, network-type information is not universally available across browsers: [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API).

These external references check only the specified implementation boundaries; they are not a comprehensive audit of the product, network accessibility, course validity, or licence texts.

### Shared lookup and selection refinements (2026-10-11)

Library query tools follow the latest ref-list ZIP: one card padded20px/20px/8px, serif20px heading, Dictionary → IPA → Usage as three vertical52px rows on desktop and mobile. Remove inner tiles, subtitles and arrows; use inset dividers,8px hover corners and the shared visible keyboard focus. About uses the existing accent underline. Download/choose backup actions share filled styling; Current profile and Content list retain their existing behavior with visible raised surfaces. Hover applies only to unselected options/resources, preserving checked and feedback colors; dark selection uses warm sage343C31.

Maintainer23:02 screenshot correction: the85% menu tint appeared opaque. Shared menu tint is now55% raised surface with actual24px backdrop blur and140% saturation; check-only selection/6% hover, bounded placement and solid reduced-transparency/unsupported fallback remain. This explicit visual correction supersedes the supplied85% tint.

Latest daily-quote package (SHAacb5fe067efdd6519358ff86c203b2b9197658b483132efcf86de77bcd81f092): plain page surface, serif20px desktop/18px narrow (maintainer sizing correction2026-10-12),1.45 line height, maxmin(60ch,720px), quiet13px source disclosure with original complete citation and fixed-revision source link inside,44px grey refresh icon. Keep long-quote full-text expansion and actual catalogue/day selection. Today fern160px desktop/96px mobile (maintainer sizing correction2026-10-12), with32px mobile gap before quote;40px quote/practice gap. Existing fern artwork/growth/accessibility retained, no specimen plant replacement or fabricated author fields. Bottom handwritten wordmark is removed per maintainer; top brand remains.

Quote source-row QA refinement: use the existing exact locator as its concise two-line disclosure label (fallback actual page title), rather than a thematic page plus alphabetical section such as “Virtue · E”. No author/work inference; expand for complete page/locator/revision link.


2026-10-11 latest maintainer refinements: Library follows the supplied grouped-row ZIP (search, mixed checkbox, precise installed status, floating selected actions). Desktop and mobile navigation use filled active/focus pills instead of animated underlines. Both History entries share outline plus1.04 focus scale, static under reduced motion. Practice/Test sit above the source divider. Quote expansion uses four measured lines; short quotes remain complete. Newest About ZIP supersedes earlier separate cards with two compact rows, real version/state and About in ordinary text with a trailing arrow (2026-10-12 maintainer correction).

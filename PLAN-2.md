# Build plan 2: Themes and story banks (Christmas update)

Build to `SPECS-2.md` (API changes, rules R8–R14, token names, edge cases) and the theme sheets in `theme-specs/` (each theme's values), and follow `CLAUDE.md` (layers,
conventions, Tailwind v4, readability floor, guardrails). Every step ends with `./test.sh` passing and
the human reviewing the diff. One endpoint or one component per change.

Backend first (steps 1–4), so the frontend has something to send `theme` to. Each backend step stays
compatible with today's frontend (`theme` is optional).

```
ThemePicker (home) ─ themeId ─→ App ─→ <html data-theme>      (CSS variables switch the look)
                                  │  └→ localStorage "story-theme"
                                  ├→ NewStoryForm  POST /api/stories {idea, theme}
                                  └→ StoryList     GET  /api/stories?theme=…
backend: stories.theme ─→ services ─→ llm.start_story/continue_story(…, theme) ─→ mood line
```

---

## Step 1: Schema and narrator mood (no API change yet)
- [ ] `schema/postgres.sql` (after the `CREATE TABLE`s):
  ```sql
  ALTER TABLE stories ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'halloween';
  CREATE INDEX IF NOT EXISTS stories_by_theme ON stories (theme, created_at DESC, id DESC);
  ```
  Existing dev and deployed stories become Halloween on the next backend start. No reset needed.
- [ ] `schemas.py`: `ThemeId = Literal["halloween", "christmas"]`.
- [ ] `llm.py`: remove the "Lean eerie…" line from `SYSTEM_PROMPT`. Add `MOODS: dict[str, str]` (one line per
  theme, from its sheet in `theme-specs/`). `_ask(shape, prompt, theme)` sends `system(SYSTEM_PROMPT + "\n" + MOODS[theme])`.
  `start_story(idea, max_level, theme)`, `continue_story(…, final, theme)`.
- [ ] `conftest.py`: `FakeLLM.start_story` / `continue_story` take `theme` and record it in `calls`.
- [ ] Services pass `theme="halloween"` for now (it gets wired in Steps 2 and 4).

Tests:
- [ ] `test_schema.py`: new story row gets `theme = 'halloween'` by default; running the schema twice is fine.
- [ ] `test_llm.py`: every value of `ThemeId` has a `MOODS` entry; the system message for christmas contains the christmas line and not the halloween one.

**Done when:** `./test.sh` passes; `./dev.sh` on the existing dev DB starts and old stories still open.

## Step 2: `POST /api/stories` takes a theme
- [ ] `schemas.StoryCreate`: `theme: ThemeId = "halloween"`. `schemas.Story`: `theme: ThemeId`.
- [ ] `repositories/stories.insert` writes `theme`; `get` / `list_all` return it (`RETURNING *` already does).
- [ ] `services/stories.create_story(conn, idea, theme)` → `llm.start_story(idea, max_level, theme)`.
- [ ] Handler passes `body.theme`.

Tests (`test_stories.py`):
- [ ] `theme: "christmas"` → 201 with `theme` christmas, LLM called with christmas; get-by-id returns it
- [ ] no `theme` → 201 halloween
- [ ] `"easter"`, `""`, `null`, `5` → 422, LLM not called, no row

## Step 3: `GET /api/stories?theme=`
- [ ] Handler: `theme: ThemeId | None = None` query param (FastAPI gives 422 for unknown values).
- [ ] `services/stories.list_stories(conn, theme)`; `repositories/stories.list_all(conn, theme)` adds
  `WHERE s.theme = %s` only when given. Two fixed SQL strings, no string building.

Tests:
- [ ] two halloween + one christmas → `?theme=christmas` returns the one; `?theme=halloween` the two, newest first
- [ ] `?theme=christmas` with none → `[]`
- [ ] no param → all three
- [ ] `?theme=easter` → 422

## Step 4: Choosing uses the story's theme
- [ ] `repositories/nodes.get` also returns the story's `theme` (it already joins `stories` for title, idea, `max_level`).
- [ ] `services/nodes.choose` passes `node["theme"]` to `llm.continue_story`.
- [ ] `NodeView` response unchanged (`theme` isn't added to it).

Tests (`test_choose.py`):
- [ ] choose in a christmas story → `continue_story` called with christmas; in a halloween story → halloween
- [ ] walking an existing branch still makes no LLM call

**Done when:** `./test.sh` passes; a manual `curl` creates a Christmas story through the proxy and its passages read warm and festive.

## Step 5: Neutral token names (frontend, no visible change)
| Old | New |
|---|---|
| `night` / `crypt` / `crypt-edge` / `tomb` | `bg` / `surface` / `edge` / `field` |
| `bone` / `mist` | `ink` / `muted` |
| `pumpkin` / `slime` / `blood` | `accent` / `success` / `danger` |
| `font-spooky` | `font-display` |

- [ ] `index.css`: rename the variables, same values, update the contrast comment.
- [ ] All components: update classes, including compound ones (`crypt-edge` before `crypt`, `shadow-pumpkin/30`, `ring-pumpkin/30`, `outline-pumpkin`, `bg-night/85`, `bg-bone/30`, `fill-night`, `stroke-mist`).
- [ ] `grep -rnE '\b(night|crypt|tomb|bone|mist|pumpkin|slime|blood|spooky)\b' frontend/src` finds no class names.

**Done when:** `./test.sh` passes; screenshots at 1280 and 390 px match the previous ones.

## Step 6: Theme list, Halloween moved onto it (no visible change)
- [ ] `api.ts`: `Story` type gains `theme`.
- [ ] `frontend/src/themes.ts`:
  ```ts
  export type ThemeId = 'halloween'          // must match backend schemas.ThemeId; 'christmas' in Step 8
  export type Theme = {
    id: ThemeId; label: string                            // label: "Halloween", used in aria-label/title
    PickerIcon: ComponentType<{ className?: string }>     // flat one-colour silhouette for ThemePicker
    Decor: ComponentType                                  // page background layer
    Icon: ComponentType<{ className?: string }>           // loader + peeking over the story card
    CardCorner: ComponentType<{ className?: string }>     // cobweb / holly
    copy: { tagline, intro, ideaPlaceholder, createButton, creating, choosing, slow, customPlaceholder,
            listHeading, listLoading, emptyList, unreachable: string }
  }
  // plus on Theme: festival?: { month: number; day: number }   // 1-based; none = never picked by date
  export const THEMES: Theme[]
  export const FALLBACK_THEME: ThemeId = 'halloween'       // only if no theme has a festival
  export function findTheme(id: unknown): Theme | null     // unknown → null
  export function seasonalTheme(today: Date): Theme        // see "Seasonal default" in SPECS-2.md
  ```
  `seasonalTheme` works on local calendar dates only (`new Date(y, m - 1, d + 7)` for each festival in
  `y - 1`, `y`, `y + 1`, keep those `>=` today's local midnight, take the soonest). It's a pure function: no
  `localStorage`, no `Date.now()` inside.
- [ ] Move `HauntedDecor.tsx`, `Ghost.tsx`, `Cobweb.tsx` to `frontend/src/themes/halloween/`, contents unchanged.
- [ ] `SpookyLoader.tsx` → `ThemedLoader.tsx` with props `{ message, slowMessage, Icon }`.
- [ ] `App.tsx` renders `<theme.Decor />` and the themed tagline/banner, and passes `theme` to `NewStoryForm`, `StoryList`, `StoryView`, which read their text and icons from it.
- [ ] `NewStoryForm` sends `{ idea, theme: theme.id }`. `StoryList` fetches `/api/stories?theme=${theme.id}`.

**Done when:** `./test.sh` passes; the page looks and reads as before; no component outside `themes/` imports a Halloween file.

## Step 7: Seasonal default, picker and saved choice
- [ ] `themes.ts`: `startingTheme(today: Date): Theme`. It reads `localStorage['story-theme']` in `try`,
  parses `{theme, season}`, and returns the saved theme only if both ids are known and
  `season === seasonalTheme(today).id`. Anything else → `seasonalTheme(today)`.
  `savePick(theme: ThemeId, today: Date)` writes `{theme, season: seasonalTheme(today).id}` in `try`.
- [ ] `main.tsx`: before `createRoot(...).render`, `const start = startingTheme(new Date())`, set
  `document.documentElement.dataset.theme = start.id`, and pass `start.id` to `<App initialTheme=… />`.
  This runs before React's first render, so the content never shows in the wrong theme. There's no inline
  script in `index.html` and no second copy of the date logic.
- [ ] `App.tsx`: `themeId` state starts from `initialTheme`. A pick calls `setThemeId`, sets
  `document.documentElement.dataset.theme` and calls `savePick`. The date default is never saved, only
  manual picks are.
- [ ] Check `seasonalTheme` with a throwaway script in the scratchpad (`node` 24 runs `.ts` directly):
  Oct 31, Nov 7 → halloween; Nov 8, Nov 20, Dec 25, Jan 1 → christmas; Jan 2, Feb 29 2028, Jul 4 → halloween.
  (The repo has no frontend test runner. Adding Vitest would be a new library, so it needs a separate yes.)
- [ ] `themes/halloween/Pumpkin.tsx`: flat silhouette, `viewBox="0 0 24 24"`, one `fill-current` path (a slightly squashed round body with two shallow rib notches cut out, a short stem on top). No faces, no outlines. It's Halloween's `PickerIcon`.
- [ ] `ThemePicker.tsx`, at the top middle of the home page above the title (`flex justify-center gap-2`):
  - `role="radiogroup"`, `aria-label="Story theme"`. One `role="radio"` button per theme with `aria-checked`, `aria-label` / `title` = "`<label>` stories". The icon is `aria-hidden`.
  - Each button is `size-11` (44px) with the icon `size-6` (24px) inside. Unselected: `text-muted opacity-70 hover:opacity-100`. Selected: `text-accent` plus a 4px `bg-accent` dot under the icon. No background fill, border or animation.
  - `focus-visible` ring in `accent`. Left/Right arrows move and select (roving `tabIndex`).
  - Shown on the home page only. Check `muted` at 70% opacity stays ≥ 3:1 on `bg` in both themes; if not, use full opacity.
- [ ] `StoryList`: refetches when `theme.id` changes and ignores a stale response (an `ignore` flag in the effect cleanup).

**Done when:** `./test.sh` passes; the date checks above pass; the picker shows one button (Halloween,
the only theme with a festival so far, so it's also the default); a saved value of `"easter"`, a plain
string or broken JSON + reload → the seasonal default, no errors.

## Step 8: Christmas theme
- [ ] `index.html`: add `family=Mountains+of+Christmas:wght@400;700` to the Google Fonts link.
- [ ] `index.css`: a `[data-theme='christmas'] { … }` block with all ten values from `theme-specs/christmas.md`, plus `--color-holly`. Add `snowfall` (fall with a slight sideways drift) and `twinkle` (opacity 0.4 ↔ 1) to `@theme`. Add a contrast comment.
- [ ] `frontend/src/themes/christmas/`:
  - `Snowflake.tsx`: 6-armed inline SVG, `stroke-ink`.
  - `Bauble.tsx`: bauble with a cap and a holly stripe (`fill-accent`, `fill-holly`). The theme's `Icon`.
  - `Holly.tsx`: two leaves and three berries. The `CardCorner`.
  - `FestiveDecor.tsx`: same layer rules as `HauntedDecor`. Holly in the top corners (≈25% opacity), 2–3 baubles dangling on threads in the margins (lg+, `animate-dangle`), 8–10 snowflakes falling in the margins only (lg+, staggered, 10–18 s, 30–60% opacity), 2 still flakes in the header corners below lg. `motion-reduce:animate-none` on everything that moves.
- [ ] `themes/christmas/Tree.tsx`: flat silhouette, `viewBox="0 0 24 24"`, one `fill-current` path (three stacked triangles getting wider downwards, a small square trunk). No star, baubles or outline. It's Christmas's `PickerIcon`.
- [ ] `themes.ts`: add `'christmas'` (label "Christmas", `PickerIcon: Tree`, `festival: { month: 12, day: 25 }`, the components above, the wording from `theme-specs/christmas.md`). Rerun the date checks from Step 7.

**Done when:** `./test.sh` passes; Christmas restyles the page and shows an empty bank; a story created there is listed only under Christmas.

## Step 9: Check both themes in the browser
Headless Chromium against `./dev.sh`, for each theme at 1280, 390 and 320 px:
- [ ] Create a story → play to The End → ↑ Go back → custom branch → Home → story listed in this bank only.
- [ ] The Christmas story reads warm and festive; a new Halloween story reads eerie.
- [ ] Switching bank swaps the list with no flash of the other bank's stories.
- [ ] Fresh browser (empty `localStorage`) today → opens on Christmas. With the clock faked (Chromium `--fake-time` or a CDP `Emulation.setVirtualTimePolicy`/`Date` override) to Nov 7 → Halloween, Nov 8 → Christmas.
- [ ] Pick Halloween, reload → Halloween, no flash. Fake the date to Jan 10 → Halloween (pick dropped, new season). Pick Halloween on Nov 20, fake Dec 1 → still Halloween.
- [ ] Tab through every control: focus ring visible; the picker works with the arrow keys.
- [ ] Reduced motion: nothing moves. No decoration over text or controls, no horizontal scroll.
- [ ] Contrast spot-checked against each theme's sheet in `theme-specs/`.

## Step 10: Docs and deploy (needs the human's OK)
- [ ] `SPEC.md`: Story gains `theme`; POST/GET rows link to `SPECS-2.md`; line 15 says the UI is themed.
- [ ] `CLAUDE.md`: "Halloween theme rules" → "Theme rules" (neutral tokens, `themes/<id>/`, keep `ThemeId` in sync on both sides).
- [ ] `README.md`: theme picker, story banks, how to add a theme.
- [ ] Deploy: restart the laptop backend first (the `ALTER TABLE` runs on start), then the Vercel frontend. The old frontend keeps working against the new backend in between.

## How to add the next theme (later)
Follow `theme-specs/README.md`: copy `theme-specs/TEMPLATE.md` to `theme-specs/<id>.md`, fill it in
against rules TH1–TH31, get it approved, then work through the sheet's build checklist. Each theme's
values (palette, icons, decorations, wording, mood line) come from its sheet: `theme-specs/halloween.md`
and `theme-specs/christmas.md` for this update.

## Risks
- **Dropping the eerie line changes Halloween stories slightly.** The Halloween mood line replaces it, so the tone should stay the same. Checked in Step 9.
- **Two copies of the theme list** (backend `ThemeId`, frontend `ThemeId`). If the frontend has a theme the backend doesn't know, creating a story there gets 422 with a clear message, and the list gets 422. The checklist above keeps them together.
- **The rename (Step 5) touches every component.** It's mechanical and done on its own so the diff is easy to read.
- **The deployed DB gets an `ALTER TABLE` on start.** It's idempotent and has a default, so no data is lost and no reset is needed.

# Spec 2: Themes and story banks (Christmas update)

Extends `SPEC.md`. Everything there still holds (tree, rules R1–R7, edge cases) except where this spec
adds to it. Build plan: `PLAN-2.md`.

This file covers the **theme system**: the API, storage, picker, seasonal default and how it all behaves.
Everything about **individual themes** lives in `theme-specs/`:
- `theme-specs/README.md`: the rules every theme must meet (TH1–TH31) and how to add one
- `theme-specs/halloween.md`, `theme-specs/christmas.md`: each theme's festival, palette, contrast, fonts,
  icons, decorations, wording and narrator mood line
- `theme-specs/TEMPLATE.md`: the blank sheet for the next theme

## Goal
The app comes in themes. Halloween (today's look) stays, Christmas is the first new one, and more
festivals or moods should be easy to add later.

Each theme is its own **story bank**. The player picks a theme on the home page and the whole app
switches: the look, the list of stories (only that theme's), and the narrator's mood for new stories.
A story belongs to the theme it was created in, for good.

★ Core rule: **a story's theme is set once, from the UI theme it was created in. It decides which bank
the story is listed in and the narrator's mood for every passage of that story.** The tree rules from
`SPEC.md` are unchanged and work the same in every theme.

## Decisions
- D1. Theme is per story (stored on `stories`), taken automatically from the current UI theme. The player
  never picks a theme for a story separately.
- D2. The default UI theme follows the calendar: the next festival, until one week after it (see
  "Seasonal default"). Today (Nov 20) that's Christmas.
- D3. Existing stories become Halloween stories (they were written with the eerie prompt).
- D4. The theme picker is only on the home page. A story is always opened from its own bank, so the
  story page always shows in the story's own theme.
- D5. Colour classes get neutral names (`bg-accent` instead of `bg-pumpkin`) so they make sense in every
  theme.
- D6. A theme the player picks by hand holds until the season changes. After that, the new season's
  theme takes over again, so nobody gets stuck on Halloween in December.

## Users & actions → API
Changed rows only. Everything else in `SPEC.md` is unchanged.

| Method | Path | Body / query | Success | Errors |
|--------|------|------|---------|--------|
| POST   | /api/stories | `{idea, theme?}` | 201 story (now with `theme`) | 422 (also unknown `theme`), 502, 504 |
| GET    | /api/stories | `?theme=christmas` (optional) | 200 `[story]` of that theme, newest first, `[]` when empty. No `theme` → all stories | 422 unknown `theme` |
| GET    | /api/stories/{id} | | 200 story (now with `theme`) | 404 |

Story: `{id, title, idea, theme, max_level, root_node_id, created_at}`

- `theme` is a theme id (today `"halloween"` or `"christmas"`). It's optional on create and defaults to
  `"halloween"`, so an older frontend (the deployed one) keeps working.
- No new endpoints. `GET /api/nodes/{id}` and `POST /api/nodes/{id}/choose` keep their shape. Choosing
  uses the story's stored theme for the narrator, not anything the client sends.

## Page
- **Theme picker (`ThemePicker`)**, on the home page only, at the **top middle** of the page, above the
  title. It's a small, quiet row of icons with no text, one per theme, each the theme's `PickerIcon`
  silhouette (TH18) at about 24px in a 44×44px button.
  - Unselected icons are `muted` at 70% opacity. The selected one is `accent` with a small dot under it,
    so the selection doesn't rely on colour alone. Hover brings an icon to full opacity.
  - Accessible: a radio group (`role="radiogroup"`, `aria-label="Story theme"`), each button
    `role="radio"` with `aria-checked` and `aria-label` "`<Label>` stories", plus a `title` tooltip with
    the same text. The SVG is `aria-hidden`. Focus ring as on every control. Arrow keys move the selection.
- **App (`App.tsx`)** holds `themeId` alongside `nodeId`. It puts `data-theme="<id>"` on `<html>`, saves
  manual picks in `localStorage` (key `story-theme`), and passes the theme to the components. With no
  valid saved pick for this season, it starts on the seasonal default.
- **NewStoryForm** sends `{idea, theme: themeId}`. Its placeholder, intro and button text come from the theme.
- **StoryList** reads `GET /api/stories?theme=<themeId>` and reloads when the theme changes. The heading,
  loading line and empty state come from the theme.
- **StoryView** has no picker. It shows in the current theme, which is always the story's theme (D4).
  The custom-action placeholder, the peeking icon and the card-corner ornament come from the theme.
- **Loader (`ThemedLoader`, was `SpookyLoader`)**: same behaviour, icon and text from the theme.
- What each theme supplies (tokens, font, `Decor`, `PickerIcon`, `Icon`, `CardCorner`, wording keys, mood
  line) is listed in `theme-specs/TEMPLATE.md`. The values are in each theme's sheet.

## Seasonal default
Each theme may have a festival date (month and day), given in its sheet (TH4). A theme without one is
never picked by date, only by hand.

How it's worked out, in the browser's local date (no time of day):
1. For each theme with a festival, its season ends 7 days after the festival.
2. Look at the end dates for last year, this year and next year, and keep those on or after today.
3. The theme whose end date comes soonest is the default.

So a festival stays the default for a week after it, then the next festival in the calendar takes over.
A new theme with a festival slots in automatically. Each sheet states its resulting window (TH6).

The theme that's the default today is called the **season**. It's saved with any manual pick (D6).

## Nouns → tables
- stories gains `theme TEXT NOT NULL DEFAULT 'halloween'`.
  - Added with `ALTER TABLE stories ADD COLUMN IF NOT EXISTS ...` in `postgres.sql`, so the dev and deployed
    databases pick it up on the next start with no reset and no data loss. Existing rows get `halloween` (D3).
  - No DB `CHECK` on the value: the allowed list lives in the backend (`schemas.ThemeId`), so adding a
    theme doesn't need a migration. The API is the only writer.
  - Index `(theme, created_at DESC, id DESC)` for the filtered list.
- nodes: unchanged. A node's theme is its story's theme.

## Narrator mood (`app/llm.py`)
- The shared system prompt loses "Lean eerie and atmospheric where it suits the player's idea."
- `llm.MOODS` maps each theme id to its one-line mood (from the theme's sheet, TH24–TH26), appended to the
  shared prompt.
- `start_story(idea, max_level, theme)` and `continue_story(..., theme)` take the theme. The service passes
  the story's stored theme.
- The player's idea still wins: a spooky idea in the Christmas bank gets a spooky story told in a festive
  voice (TH25).

## Theme tokens
The rename (D5). Each theme sets every token. The values are in its sheet (TH7).

| Token (was) | Use |
|---|---|
| `bg` (`night`) | page background |
| `surface` (`crypt`) | cards, panels |
| `edge` (`crypt-edge`) | decorative card borders |
| `field` (`tomb`) | input and secondary button borders |
| `ink` (`bone`) | main text |
| `muted` (`mist`) | secondary text, unselected picker icons |
| `accent` (`pumpkin`) | primary buttons (`bg`-colour text on top), focus ring, headings |
| `success` (`slime`) | explored marker |
| `danger` (`blood`) | errors |
| `font-display` (`font-spooky`) | headings only |

## Rules
R8. ★ A new story's theme is the UI theme at the moment of creation, sent by the frontend. Unknown → 422.
    Missing → `halloween`.
R9. A story's theme never changes. Every passage of it is generated with that theme's mood.
R10. `GET /api/stories?theme=X` lists only stories of theme X, same order as today. No filter → all.
R11. The starting UI theme is the saved pick if it was made in the current season, otherwise the seasonal
     default. A pick is saved as `{"theme": "<id>", "season": "<id>"}`. An unknown theme, a different
     season, the wrong shape or unreadable storage all fall back to the seasonal default. Blocked
     `localStorage` → works for the session only. The theme is applied before React's first render
     (no flash of the wrong theme).
R12. The seasonal default is only for the UI. The backend's default for a missing `theme` (old clients)
     stays `halloween`.
R13. Switching theme on the home page reloads the list for that bank. It never creates, changes or
     deletes anything.
R14. Every theme meets TH1–TH31 in `theme-specs/README.md`.

## Edge cases (decided)
- Create with `theme: "christmas"` → 201, `theme` is christmas, the LLM gets christmas
- Create without `theme` → 201, halloween
- Create with `theme: "easter"`, `""`, `null` or `5` → 422, LLM not called
- List `?theme=christmas` with only Halloween stories → `[]`
- List `?theme=easter` → 422
- List with no `theme` → every story, newest first (old clients)
- Choose in a Christmas story → `continue_story` gets christmas, whatever the UI shows
- Existing stories after the upgrade → listed under Halloween, keep playing as before
- First visit on Oct 31 → Halloween. Nov 7 → Halloween. Nov 8 → Christmas. Nov 20 → Christmas.
  Dec 25 → Christmas. Jan 1 → Christmas. Jan 2 → Halloween. Feb 29 → Halloween.
- Picked Halloween on Nov 20 (Christmas season) → still Halloween on reload until Jan 1. On Jan 2 the season
  is Halloween, so the saved pick is dropped and it shows Halloween anyway. Picked Christmas on Nov 1 →
  Christmas until Nov 7, and from Nov 8 the Christmas season starts, so it's dropped (still Christmas).
- Picked Halloween on Nov 20, comes back Jan 10 → Halloween (new season, pick dropped)
- Saved `{"theme": "easter", …}`, an old plain `"halloween"` string, or invalid JSON → seasonal default
- Page left open across midnight into a new season → no change until the next load
- Wrong device clock → the default follows the device's date; the picker still works
- Switch bank on the home page while the list is loading → the old response is ignored (no flash of the other bank's stories)
- Switch bank while a story is being created → can't happen: the loader overlay blocks the page
- Reduced motion → no theme decoration moves
- Phone widths 320–390px → only a few small decorations, nothing behind text, no horizontal scroll
- Heading font fails to load → falls back to Lora/Georgia

## Scope
**This update:** theme column + filter + per-theme narrator mood, neutral token names, Halloween moved onto
the theme system unchanged, Christmas theme, home page picker, seasonal default by date, saved choice per season.
**Later:** more themes, festivals with a different date each year (Easter, Lunar New Year), light themes
(per-theme `color-scheme`), URL per bank (`/christmas`), themed favicon/page title, moving a story to
another bank.
**Out of scope:** new npm or Python packages, sound/music, accounts.

## Assumptions
- The page title stays "Story Interactive" in every theme.

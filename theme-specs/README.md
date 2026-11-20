# Theme specs

One sheet per theme. A theme is a look (palette, fonts, decorations, icons, wording), a story bank
(stories created in it are listed only in it) and a narrator mood (how Grok leans when it writes).
How the theme system works is in `../SPECS-2.md`. This folder is what each theme must provide.

| Sheet | Theme | Festival | Status |
|---|---|---|---|
| [halloween.md](halloween.md) | Halloween | Oct 31 | live (moves onto the theme system in PLAN-2) |
| [christmas.md](christmas.md) | Christmas | Dec 25 | planned (PLAN-2 Step 8) |
| [TEMPLATE.md](TEMPLATE.md) | blank sheet to copy | | |

## Adding a theme
1. Copy `TEMPLATE.md` to `<id>.md` and fill in every section. Leave nothing as "TBD".
2. Get the sheet approved before writing any code (same rule as `SPEC.md`).
3. Build it with the checklist at the end of the sheet, one change at a time, `./test.sh` after each.
4. Add a row to the table above.

## Rules every theme must meet
These are fixed. A theme sheet can't override them. Changing one means changing this file, with approval.

### Identity
- TH1. `id` is lowercase letters and hyphens (`halloween`, `lunar-new-year`), never changes once stories
  exist under it (it's stored on `stories.theme`), and is never reused for a different theme.
- TH2. A theme is never removed while stories use it. To retire one, hide it from the picker and keep
  its id, mood line and styles so old stories still open.
- TH3. The id is listed in both places, and they must match: backend `schemas.ThemeId` + `llm.MOODS`,
  frontend `ThemeId` + `THEMES` in `frontend/src/themes.ts`.

### Season
- TH4. A theme either has one fixed festival date (month + day) or none. With a date it becomes the
  default from the end of the previous festival's week until 7 days after its own date. With none it's
  pick-only (a "vibe" theme).
- TH5. Festivals that move each year (Easter, Lunar New Year, Diwali, Eid) aren't supported yet: they
  need a date per year, which is a change to `SPECS-2.md` first.
- TH6. The sheet lists the resulting default window (e.g. "Nov 8 – Jan 1"). A new festival shortens a
  neighbour's window, so update that sheet too. The sheets are the only place the windows are written down.

### Colours (all ten tokens, no others used for text)
- TH7. Every token is set: `bg`, `surface`, `edge`, `field`, `ink`, `muted`, `accent`, `success`,
  `danger`, plus `font-display`. Values are hex. Tokens keep their job in every theme (e.g. `accent` is
  always the primary button, focus ring and headings).
- TH8. Contrast (WCAG 2.x), measured and written into the sheet:
  - `ink` on `bg` and on `surface` ≥ 7:1
  - `muted`, `accent`, `success`, `danger` on `surface` ≥ 4.5:1 (also on `bg` where they appear there)
  - `bg` text on `accent` (primary buttons) ≥ 4.5:1
  - `field` on `surface` and `bg` ≥ 3:1 (input borders must be findable)
  - `muted` at 70% opacity on `bg` ≥ 3:1 (unselected picker icons)
  - `edge` and theme-only extras are decorative and have no minimum, and are never used for text.
- TH9. `danger` must be clearly different from any decorative colour, so an error never looks like decoration.
- TH10. All themes are dark for now (`color-scheme: dark` is global). A light theme needs a change to `SPECS-2.md`.

### Type
- TH11. `font-display` is for headings only (page title, section headings, story title, "The End").
  Passages are always Lora 18px. Buttons, inputs and body text use the system sans. Never change these.
- TH12. The display font is on Google Fonts (added to the link in `index.html`), falls back to
  `"Lora", Georgia, serif`, and is still readable at `text-2xl`: check "The End" and a long story title.

### Decorations
- TH13. Inline SVG only (no images, no new packages), coloured with theme tokens (`fill-ink`, `stroke-muted`, ...).
- TH14. `aria-hidden`, `pointer-events-none`, inside the background layer under the `z-10` content,
  positioned `absolute` (scrolls with the page), never over text or controls at 1280, 390 or 320 px.
- TH15. Most decorations sit in the side margins (lg and up). Below lg, at most 2–3 small ones in the
  header's empty corners. Opacity 15–80%.
- TH16. Motion is slow and gentle (no flashing, nothing faster than one cycle per 3 s, no more than 3
  flashes per second ever), and every moving element has `motion-reduce:animate-none`.
- TH17. New keyframes go in `@theme` in `index.css` with a theme-prefixed or descriptive name.

### Icons (each a component in `frontend/src/themes/<id>/`)
- TH18. `PickerIcon`: one flat silhouette, `viewBox="0 0 24 24"`, a single `fill-current` shape, no
  outline, face, gradient, text or animation. Recognisable at 24px in one colour. It must look different
  from every other theme's picker icon at a glance.
- TH19. `Icon`: used in the loader (~80px) and peeking over the story card (~40px). May have 2–3 token colours.
- TH20. `CardCorner`: a small corner ornament inside the story card, behind its text, ≤ 20% opacity.

### Words
- TH21. Every copy key in the template is filled. Wording sets the mood but must still say what happens:
  the create button still means "create", the slow message still says it's still working.
- TH22. Lengths: tagline ≤ 60 characters, buttons ≤ 20, other lines ≤ 90. Plain English a 10-year-old can read.
- TH23. Some words are never themed, so players always find them: "Home", "↑ Go back", "Start over",
  "Level n of max", "explored", the counters, error details, and the labels "Your story idea" /
  "Or write your own action".

### Narrator mood
- TH24. One sentence, starting "Lean …". It sets the mood and setting, and nothing else: it doesn't
  change the passage length, the options, the format or the audience from the shared prompt.
- TH25. It's a lean, not a filter: the player's idea and custom actions still win.
- TH26. General audience, no graphic gore, no real people.
- TH27. Before shipping: generate at least 3 stories in the theme (one neutral idea, one matching idea,
  one opposite idea) and note in the sheet that the mood shows and the format is unchanged.

### Content and respect
- TH28. No trademarked or copyrighted characters, brands or logos in decorations, wording or mood
  (no Grinch, Rudolph, Frosty, Jack Skellington, ...). Folklore figures (Santa, witches, ghosts) are fine.
- TH29. For a religious or cultural festival, keep the theme to its public, festive side (lights, food,
  seasons, folklore) and avoid sacred symbols. If unsure, ask someone who celebrates it.

### Checks before a theme ships
- TH30. `./test.sh` passes (the backend test checks every `ThemeId` has a mood line).
- TH31. The browser checks in PLAN-2 Step 9 pass for the new theme, and the sheet's checklist is ticked.

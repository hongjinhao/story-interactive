# Spec 3: The storybook (UI/UX update)

Extends `SPEC.md` and `SPECS-2.md`. Everything there still holds (tree, rules R1–R14, themes, banks,
edge cases) except where this spec changes it. Build plan: `PLAN-3.md`. Agreed look and motion:
the mockup at https://claude.ai/artifact/QcEM9arVvXEn61HY2b6ZiU (version 6).

## Goal
Playing a story should feel like reading a book that is being written for you. The story screen becomes
one open book page. A hand with a quill writes the player's words (the idea on the cover, each chosen
action at the top of a page) while Grok is working, so the wait is part of the story instead of a
loading overlay. Readability and ease of use still come first (`CLAUDE.md`, TH8–TH12).

★ Core rule: **the book only shows what the tree says.** A page turn forward is a walk down (existing
child) or a generate (new child), a page turn back is a walk up, and the one-custom-branch rule is
unchanged. Animation never decides anything and never hides an error.

## Decisions
- D7. The story screen is **one page** of an open book (the right-hand page) on every screen width. The left
  side always shows about 30% of what lies open there, cut off by the book's edge with a soft fade: the **inside
  of the cover** (in the cover's own colour) on page 1, and the **back of the previous page** (blank paper)
  after that. Never any text. On phones the strip is about 12% of the page width, so the page stays wide enough
  for 18px text. A closed book shows only the cover. A turning page or the cover never fades out: it swings over
  and lands on the left side, which then shows it. Decorative only: `aria-hidden`, no controls.
- D8. "Level n of max" becomes **"Page n of max"** everywhere in the UI. The API keeps `level` / `max_level`.
- D9. Each page shows, top to bottom: story title and "Page n of max" (with progress dots), **the action
  that led here** in a grey box, the passage, then the choices and the custom-action box. The action is in
  the passage font and ink colour; only the grey box sets it apart. On page 1 the action line is the player's idea.
- D15. **Every page and the cover are the same height**, so a turning page never changes size. The height is
  fixed per screen width (below). Content that doesn't fit shrinks (R23) instead of growing the page.
- D16. **Less text on the page.** No "What do you do?" heading and no visible "Or write your own action"
  label (it stays as a screen-reader label; the input's themed placeholder shows what it's for). The custom
  option loses its "a player's path" tag (screen readers still hear it). No "Do it" text: the ✦ key submits.
  The counter appears inside the input row once typing starts. No "custom branch already taken" line: the filled ✦
  row says it (this replaces `SPEC.md`'s "disabled with a reason"). "explored" stays: it's information.
- D17. **All choices look the same**: three rows, text on the left and a key on the right (`[A]`, `[B]`, `[✦]`).
  The third row is the custom input, or the existing custom option once someone has written one.
- D10. The pages are **light paper with dark ink**. The rest of the screen stays dark. This is the one light
  surface in the app and has its own tokens (`page-*`, below). Themes stay dark otherwise (TH10 amended).
- D11. The quill writes during every wait for Grok: the idea on the cover while a story is created, the chosen
  action at the top of a blank page while a passage is generated. It replaces `ThemedLoader`, which is removed.
- D12. A small "Story Interactive" sits next to "← Home" on the book screen. The big title, tagline and
  theme picker are on the home page only.
- D13. The new-story form only collects the idea. The book screen sends `POST /api/stories`, so the cover
  and the request share one screen with nothing to hand over.
- D14. Each theme supplies its own `Quill` (hand and pen) component. Halloween: a gloved hand with a dark crow
  quill. Christmas: a white glove with a red-and-white striped pen. The cover is shared and coloured by tokens.
  The quill writes in Lora (italic 600 on the cover, regular in the action box). No handwriting font.

## Users & actions → API
One changed response. No new endpoints.

| Method | Path | Change |
|--------|------|--------|
| GET    | /api/nodes/{id} | node view gains `story_idea` and `choice_text` |
| POST   | /api/nodes/{id}/choose | the returned node view gains the same two fields |

Node view: `{id, story_id, story_title, story_idea, parent_id, level, max_level, choice_text, content,
is_ending, options, can_add_custom}`

- `choice_text` is the words of the choice that led to this node (the option's text, or the custom action).
  `null` on the root. Both are already stored (`nodes.choice_text`, `stories.idea`) and already read by
  `repositories/nodes.get`; only the response model and the service change.
- Additive only, so the deployed frontend keeps working against the new backend.

## Screens and flow
### Home (`NewStoryForm`, `StoryList`, `ThemePicker`)
Unchanged look. Submitting the idea (button or Enter) no longer posts: it calls `onStart(idea)` and the
book screen takes over. Picking a story from the list calls `onOpen(rootNodeId)` as today.

### The book (`StoryView` → `Book` → `StoryPage`)
| Moment | What happens | Requests |
|---|---|---|
| **New story** | Home fades out. A closed book appears; the quill writes the idea on the cover. If the story isn't back when the writing ends, the pen taps and waits. When it arrives, the cover swings open onto page 1. | `POST /api/stories`, then `GET /api/nodes/{root}` |
| **Open a saved story** | The book appears closed with the story title on the cover (already written, no pen) and opens straight away. | `GET /api/nodes/{root}` |
| **Pick an explored option** | The page turns forward to the child. | `GET /api/nodes/{child}` first, then the turn |
| **Pick a new option / custom action** | The page turns forward to a blank page. The quill writes the action at the top; the passage area says `theme.copy.choosing`. When the node arrives, the passage inks in sentence by sentence, then the choices fade in. | `POST /api/nodes/{id}/choose` sent before the turn starts |
| **↑ Go back** | A page swings back over from the left onto the parent. | `GET /api/nodes/{parent}` first |
| **Start over** (ending) | One backward turn to page 1. | `GET /api/stories/{id}`, `GET /api/nodes/{root}` |
| **Home** | The cover swings shut, the book fades out and is removed, the home page fades in. | none |

- **Status line** under the book (`role="status"`): `theme.copy.creating` / `theme.copy.choosing` while
  waiting, `theme.copy.slow` after 10 s (as R4 and the SPEC 10-second rule). Empty otherwise.
- **The page turn** rotates a "leaf" around the spine (left edge) with a 3D transform: forward, the old page
  lifts away to the left. Back, the parent page swings in from the left. The leaf shows a static, `inert`,
  `aria-hidden` copy of the page it carries, so nothing on it can be clicked or read twice.
- **Durations:** page turn 0.9 s, cover open 1.2 s, cover close 1.0 s + 0.35 s fade.
- **Quill speed:** about 50 ms per character, capped so any action is written in ≤ 2.5 s and any idea in ≤ 4 s.
- The theme's `Icon` still peeks over the book's top edge and `CardCorner` sits in the page's bottom-right
  corner (TH19, TH20), behind the text.

### The page (`StoryPage`)
A flex column filling the fixed page height: header, action box and choices take their natural height and
the passage takes the rest.
- Header row: story title (`font-display`, `page-accent`), "Page n of max" (system sans, `page-muted`,
  focus target after every move, as today) and one dot per page.
- Action box: Lora 18px, `page-ink`, on `page-shade` (grey) with rounded corners and a little padding. It's real
  text for screen readers. While the quill writes, the animated lines are `aria-hidden` with a visually hidden
  full copy next to them.
- Passage: Lora 18px, `page-ink`, line height 1.65, `max-w-prose`. Shrinks to fit (R23).
- Choices: **always three rows of the same shape**: text on the left, a square key on the right.
  ```
  [ Knock on the door            explored  [A] ]
  [ Walk back to the lighthouse            [B] ]
  [ Light a candle and wait…     12/100    [✦] ]   ← empty custom input, ✦ submits it
  [ Whistle at the raven                   [✦] ]   ← or, once someone wrote one, the custom option itself
  ```
  - A/B rows are one button each (the whole row is clickable); the key is part of it. Hover or focus fills the key
    with `page-accent`.
  - The custom row is the input (themed placeholder, screen-reader label "Or write your own action") with the ✦ key
    as its submit button (`aria-label="Do it"`, disabled while the input is blank). The counter shows inside the row
    once something is typed. Focus anywhere in the row rings the whole row.
  - When a custom branch exists, the third row is that option (✦ key, "explored"), and there's no input. No extra
    line of text: the filled ✦ row shows the one custom path is taken; screen readers hear "A player's path: …".
  - Rows are at least 56px tall, the keys 44×44px. "explored" stays next to the key.
- Ending: "The End" (`font-display`), Start over and Home, in place of the choices.
- Errors show inline under the choices in `page-danger`, as today.

**Page height** (cover included): `52rem` from `sm` (640px) up, `60rem` below it. On a phone the page can be taller
than the screen and the window scrolls as usual; focusing "Page n of max" after a turn brings the top into view.
Sized from the dev database: passages run 475–901 characters (median 630). The mockup fits a 640-character
passage at 18px on a 390px phone with every control visible. Step 8 checks the longest ones.

## Tokens
New tokens, set by every theme (in `@theme` for Halloween, in `[data-theme='<id>']` for the others). Values
and measured contrast go in each theme sheet.

| Token | Use | Halloween | Christmas |
|---|---|---|---|
| `page` | paper | `#efe4cc` | `#f7f1e1` |
| `page-back` | back of a turning page, edge strip | `#e2d4b6` | `#ebe2cb` |
| `page-ink` | passage and body text on paper | `#2b2118` | `#23301f` |
| `page-muted` | secondary text on paper | `#5e5146` | `#4f5a4a` |
| `page-edge` | input and button borders on paper | `#7a6650` | `#6f7f6a` |
| `page-shade` | the grey action box | `#ddd1b9` | `#e2dccd` |
| `page-accent` | story title, primary button, focus ring on paper | `#5b2a86` | `#1d5a3a` |
| `page-success` | explored marker on paper | `#2f6b2a` | `#1f5f8a` |
| `page-danger` | errors on paper | `#a3242a` | `#b3261e` |
| `book-cover`, `book-cover-deep` | the book cover (decorative) | `#2a1838`, `#160c20` | `#8c1c2b`, `#4f0d17` |
| `foil` | writing and frame on the cover | `#ffb25e` | `#f6d27a` |

Measured contrast (WCAG 2.x) on `page`:

| Pair | Minimum | Halloween | Christmas |
|---|---|---|---|
| `page-ink` | 7:1 | 12.5 | 12.3 |
| `page-ink` on `page-shade` (action box) | 7:1 | 10.4 | 10.1 |
| `page-muted` | 4.5:1 | 6.1 | 6.4 |
| `page-accent` | 4.5:1 | 7.8 | 7.2 |
| `page-success` | 4.5:1 | 5.1 | 6.1 |
| `page-danger` | 4.5:1 | 5.9 | 5.8 |
| `page` text on `page-accent` (primary button) | 4.5:1 | 7.8 | 7.2 |
| `page-edge` (borders) | 3:1 | 4.3 | 3.8 |
| `foil` on `book-cover` | 4.5:1 | 9.2 | 6.2 |

Christmas uses pine green for `page-accent` and frost blue for `page-success`, so that `page-danger`
red never looks like the theme's own colour (TH9).

## Rules
R15. ★ A forward turn happens only after the tree says where it goes: a walk turns once `GET` has returned
     the child; a generate turns to a blank page at once, but the page is only filled from the node the
     backend returned. The UI never invents a node.
R16. A back turn always goes to `parent_id` (R6). Page 1 has no "↑ Go back".
R17. While a turn, the cover or a generation is running, every control in the book is disabled, so a
     choice can't be sent twice (replaces the overlay that `ThemedLoader` used for this).
R18. If generating fails (502, 504, network) the blank page turns back to the page the player was on, and the
     error shows under its choices. Nothing was saved (R7). The typed custom action is kept.
     On 409 the same happens, then that page reloads so the existing custom option shows (as today).
R19. If creating a story fails, the closed book shows the error with "Try again" (sends the same idea) and
     "Home" (back to the form with the idea still in the box).
R20. After every turn finishes, focus moves to the new page's "Page n of max" heading (as today), without
     scrolling the window. Instead, when a turn starts, if the line with the story title and "Page n of max"
     is above the screen, the window scrolls up until that line is 12px from the top, and no further (smooth;
     instant with reduced motion). If it's already on screen, nothing scrolls.
R21. Reduced motion: no quill, words appear at once, every turn and the cover become a 0.2 s cross-fade.
     Nothing else in the flow changes.
R22. The quill writes in the passage font (Lora). No handwriting or display font in the action box.
R23. ★ Fit, never grow: if a page's content doesn't fit the fixed height, the passage font steps down
     18 → 17 → 16px until it does. 16px is the floor (the body-text minimum). If it still doesn't fit at 16px,
     the passage area scrolls inside the page (with a visible scrollbar) rather than the page growing.
     The cover's idea shrinks 36 → 18px, then truncates with "…" (page 1 shows it all).

## Edge cases (decided)
- Root node → `choice_text` `null`, `story_idea` = the idea; page 1's action line shows the idea
- Child via option a/b → `choice_text` is that option's text. Custom child → the custom text
- `GET /api/nodes/{id}` unknown → 404 (unchanged), response shape for walks unchanged apart from the two fields
- Idea of 300 characters → cover font shrinks from 36px down to 18px; if it still doesn't fit, the cover shows the
  first 90 characters and "…". Page 1 shows the whole idea
- Custom action of 100 characters → written in ≤ 2.5 s, wraps over several lines
- Story arrives before the quill finishes → the quill finishes first (≤ 2.5 s / 4 s), then the turn
- Generation slower than 10 s → status line switches to `theme.copy.slow`, the pen keeps tapping (backend gives up at 30 s → R18)
- 502 / 504 on choose → turn back, error under the choices, custom text kept (R18)
- 409 on custom → turn back, error, page reloads with the existing custom option listed (R5, R18)
- Create fails → R19. Home from there → form with the idea kept
- Clicking Home, Back or an option during a turn → ignored (R17)
- Choose at an ending → can't happen from the UI (no choices). API still returns 400
- Opening a story from the list → no pen; cover with the title opens at once
- Page left mid-turn by pressing the browser's back button → there is no routing, so nothing to handle
- Phone widths 320–390px → the turning leaf is clipped so there's no horizontal scroll; text stays ≥ 16px (passage 18px)
- Passage of 901 characters (longest so far) on a 320px phone → shrinks to 16px; if still too long, scrolls inside the page (R23)
- Page 1 with a 300-character idea in the action box → the passage shrinks first, the box never does
- Ending page → no choices, so the passage has more room and stays at 18px
- Reduced motion → R21
- Scrolled down to the choices on a phone or short laptop screen → the turn scrolls back to the page-numbering
  line, not to the top of the window; only the header with ← Home is then above the screen (R20)
- Keyboard only → every control reachable, visible focus ring in `page-accent` on paper

## Theme rule changes (`theme-specs/README.md`)
- TH8 adds the `page-*` and `foil` pairs above.
- TH10: themes stay dark, except the book's paper, which uses the `page-*` tokens.
- TH11: passages are Lora 18px, and may step down to 16px only to fit the fixed page (R23). The action box uses Lora too.
- TH16: the quill's quick wiggle and tap are short, one-off loading motion while it writes, not decoration.
  They're exempt from the 3-second rule but stop entirely with reduced motion.
- TH19: `Icon` now peeks over the book (the loader is gone).
- TH23: "Level n of max" → "Page n of max". "Or write your own action" stays as the input's screen-reader label.
  "What do you do?" and "a player's path" are removed.
- New TH32: `Quill`, a hand holding a pen, one inline SVG, nib tip at the bottom-left corner of its viewBox,
  coloured with tokens, readable on both `page` and `book-cover`, no text.

## Scope
**This update:** the book screen (cover, one page, page turns forward and back, close on Home), the quill
writing on cover and page, fixed page height with fit-to-page text, paper tokens for both themes, "Page n of max", `story_idea` + `choice_text` in the
node view, removing `ThemedLoader`.
**Later:** a bookshelf home page (story spines), per-theme cover art, page-turn sound, a path/map of the tree
drawn in the book's margin.
**Out of scope:** new npm or Python packages (the animation is CSS, SVG and the Web Animations API), URL
routing per page, light themes outside the book.

## Assumptions
- No new fonts: Lora and the display fonts are already loaded.
- The mockup's hand and quill drawing is a starting point; each theme's `Quill` is drawn to TH32.

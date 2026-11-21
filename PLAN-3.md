# Build plan 3: The storybook (UI/UX update)

Build to `SPEC-3.md` (flow, rules R15–R22, tokens, edge cases) and follow `CLAUDE.md` (layers,
conventions, Tailwind v4, readability floor, guardrails). Every step ends with `./test.sh` passing and the
human reviewing the diff. One endpoint or one component per change. No new libraries.

Backend first (Step 1), so the page has the action text to show. It's additive, so the deployed frontend keeps working.

```
App  open: null | {idea} | {nodeId}
 ├─ home: NewStoryForm (onStart idea) · StoryList (onOpen nodeId) · ThemePicker
 └─ book: StoryView  (fetches, flow, busy/error state)
            └─ Book  (cover, leaf turns forward/back, close)   ← presentation only, no fetching
                 ├─ StoryPage (one page: header, action, passage, choices)   ← pure, from props
                 └─ QuillWriting (text + theme.Quill, tapping while waiting)
```

---

## Step 0: Spec and rule edits (docs only)
- [ ] `theme-specs/README.md`: TH8, TH10, TH11, TH16, TH19, TH23 as in `SPEC-3.md` "Theme rule changes"; add TH32 (`Quill`).
- [ ] `theme-specs/halloween.md`, `christmas.md`: add the `page-*`, `book-cover`, `foil` values and their measured
  contrast rows; describe each theme's `Quill`.
- [ ] `theme-specs/TEMPLATE.md`: the new token rows, contrast rows and a `Quill` row.

**Done when:** the human has approved the edits.

## Step 1: Node view gains `story_idea` and `choice_text`
- [ ] `schemas.NodeView`: `story_idea: str`, `choice_text: str | None` (`None` on the root).
- [ ] `services/nodes.get_node_view`: return `story_idea=node["idea"]` (the row already has `idea` and `choice_text`).
  `choose` returns the same view, so it picks this up too.
- [ ] `frontend/src/api.ts`: `StoryNode` gains `story_idea: string; choice_text: string | null`.

Tests (`test_nodes.py`, `test_choose.py`):
- [ ] root → `choice_text` null, `story_idea` = the idea
- [ ] child via a / b → `choice_text` = that option's text; custom child → the custom text
- [ ] walking an existing branch (200) and generating (201) both include the two fields
- [ ] unknown node → 404 (unchanged)

**Done when:** `./test.sh` passes; `curl /api/nodes/<root>` through the proxy shows both fields.

## Step 2: Paper tokens (no visible change yet)
- [ ] `index.css`: `--color-page`, `--color-page-back`, `--color-page-shade`, `--color-page-ink`, `--color-page-muted`,
  `--color-page-edge`, `--color-page-accent`, `--color-page-success`, `--color-page-danger`, `--color-book-cover`,
  `--color-book-cover-deep`, `--color-foil` in `@theme` (Halloween), and the Christmas values in
  `[data-theme='christmas']`. Contrast comment with the `SPEC-3.md` numbers.
- [ ] Keyframes for the quill (`quill-scribble`, `quill-tap`) and the ink-in (`ink-in`) in `@theme` (TH17).

**Done when:** `./test.sh` passes; `bg-page`, `text-page-ink` etc. resolve (checked in a scratch class).

## Step 3: `StoryPage.tsx`, the story on paper (no animation yet)
- [ ] New `StoryPage.tsx`, pure: props `{ theme, node, busy, error, custom, onCustomChange, onPick, onCustom, onStartOver, onHome, headingRef }`.
  Renders the header ("Page n of max" + dots), the action box (`node.choice_text ?? node.story_idea`, Lora on
  `bg-page-shade`), the passage, the choices as three identical rows, text left and key right
  (`[A]`, `[B]`, and `[✦]` on either the custom input or the existing custom option; no "What do you do?", no
  "taken" line; D16 and "The page" in `SPEC-3.md`), the ending, and the error. Paper classes only
  (`bg-page`, `text-page-ink`, `border-page-edge`, `outline-page-accent`, ...).
- [ ] Fixed page height (`h-[60rem] sm:h-[52rem]`), flex column, passage `flex-1 min-h-0`. A small `useLayoutEffect`
  in `StoryPage` steps the passage font 18 → 17 → 16px while `scrollHeight > clientHeight`, re-run when the node,
  the error or the width changes (`ResizeObserver`); past 16px the passage scrolls (R23).
- [ ] `StoryView.tsx`: keeps the data and handlers, renders `StoryPage` on a plain paper sheet with the left side showing the inside cover or paper (D7),
  "← Home" + small "Story Interactive" above it (D12), "↑ Go back" and the status line below it.
  `App.tsx` hides the big header on the book screen. `ThemedLoader` still shows while choosing (removed in Step 6).

**Done when:** `./test.sh` passes; the whole story can be played as before, now on paper with "Page n of max" and
the action box; every page is the same height; the longest dev passage (901 characters) fits at 1280, 390 and 320 px
(by shrinking, or scrolling only past 16px); keyboard focus works, the counter appears once typing starts; no horizontal scroll.

## Step 4: `Quill` per theme and `QuillWriting.tsx`
- [ ] `themes/halloween/Quill.tsx` (gloved hand, crow quill) and `themes/christmas/Quill.tsx` (white glove,
  striped pen), TH32. `Theme` gains `Quill`; `THEMES` entries set it.
- [ ] `QuillWriting.tsx`: props `{ text, Quill, waiting, font, center?, sizes, maxMs, className }` and `onWritten()`.
  Waits for `document.fonts.load` on Lora, wraps the text into lines by measuring with a canvas
  (shrinking through `sizes` if a height is set, then truncating with "…"), reveals each line with an animated
  `clip-path` (Web Animations API), and moves the `Quill` along the edge of the reveal, wiggling while the nib is
  down. While `waiting` is true after the writing, the pen taps; when it turns false, the pen leaves.
  Animated lines are `aria-hidden` with a visually hidden full copy. Cancels its animations on unmount.
  Reduced motion: text at once, no `Quill`, `onWritten` right away.
- [ ] Try it on the action line of the current page only (temporary, removed before the step is done).

**Done when:** `./test.sh` passes; both themes write a 10-character and a 100-character action within the
time cap; reduced motion shows the text at once.

## Step 5: `Book.tsx`, the cover and page turns
- [ ] `Book.tsx`, presentation only, one fixed height shared by the sheet, every leaf and the cover (D15), with the
  left side beside the sheet (D7: grid `12fr 100fr`, `sm:30fr 100fr`, `mask-image` fade at the book's left edge;
  shows nothing while closed, the inside cover on page 1, paper after that; leaves land there instead of fading): props `{ pageKey, direction: 'forward' | 'back', cover: 'closed' | 'opening' | 'open' | 'closing', coverText, children, onSettled }`.
  It keeps the last rendered page in a ref. When `pageKey` changes it renders the old page (forward) or the new one
  (back) inside a leaf (`inert`, `aria-hidden`, front face + blank back face) above the sheet, and rotates it around
  the left edge (0.9 s), then calls `onSettled`. The cover is a leaf too (open 1.2 s, close 1.0 s + fade).
  `overflow-x: clip` on the book's wrapper so a turning leaf never makes the page scroll sideways.
  Reduced motion: 0.2 s cross-fades (R21).
- [ ] `StoryView.tsx`: renders `StoryPage` inside `Book`. Walks fetch first, then turn: explored option and
  "↑ Go back" (R15, R16). "Start over" is one backward turn to the root. Everything is disabled while a turn runs (R17).
  Focus moves to the page heading in `onSettled` (R20). Opening from the list: closed cover with `story_title`, opens at once.
  "Home": `cover="closing"`, then `onHome` after it settles.

**Done when:** `./test.sh` passes; turns forward and back look like the mockup in both themes; mashing buttons
during a turn does nothing; Home closes the book and returns to the list.

## Step 6: The blank page while generating
- [ ] `StoryView.choose` for a new branch: sends the POST, turns forward at once to a blank `StoryPage`
  (header with the next page number, `QuillWriting` with the action text, `theme.copy.choosing` in the passage area).
  When both the response and the writing are done, the page fills from the returned node: the passage inks in
  sentence by sentence, then the choices fade in.
- [ ] Errors (502, 504, network, 409): turn back to the page the player was on, show the error under its choices,
  keep the custom text; 409 also reloads that page (R18).
- [ ] Status line: `choosing`, then `slow` after 10 s (keeps the timer `ThemedLoader` had).
- [ ] Remove `ThemedLoader.tsx` once nothing imports it (D11).

**Done when:** `./test.sh` passes; option B and a custom action generate with the quill; stopping the backend
mid-generation turns the page back with the error; a second player's custom branch (409) shows up after the reload.

## Step 7: Creating a story inside the book
- [ ] `App.tsx`: `open: null | { idea: string } | { nodeId: number }` replaces `nodeId`. Shared state only, no
  fetching. `lastIdea` is kept so Home after a failed create refills the form (R19).
- [ ] `NewStoryForm.tsx`: no POST any more. Submit (button or Enter) calls `onStart(idea)`. Takes `initialIdea`.
- [ ] `StoryView.tsx`: with `{ idea }` it shows the closed cover, writes the idea with `QuillWriting`
  (Lora italic, sizes 36→18px, ≤ 4 s), sends `POST /api/stories` with `{ idea, theme }`, then `GET`s the root, then opens the cover.
  On failure: error on the cover with "Try again" and "Home" (R19). Status line: `creating`, `slow` after 10 s.
- [ ] Home fades out before the book appears; Home from the book fades the home page back in.
- [ ] Every turn starts by scrolling up to the page-numbering line if it's above the screen (12px gap, smooth;
  instant with reduced motion), and focus moves with `preventScroll`, so the window never snaps to the top (R20).

**Done when:** `./test.sh` passes; a new story goes form → quill on cover → page 1 with the idea as the action
line; a 300-character idea fits or truncates on the cover; a failed create (backend stopped) shows Try again and Home;
turning from the choices at 390×844 and 1366×768 stops with the numbering line in view, not at the top of the window.

## Step 8: Check both themes in the browser
Headless Chromium against `./dev.sh`, for each theme at 1280, 390 and 320 px:
- [ ] Every page and the cover are the same height in every turn; the longest dev passages fit (R23).
- [ ] New story → explored and new options → custom action → ↑ Go back several times → The End → Start over → Home.
- [ ] Open a saved story from the list: cover with the title opens with no pen.
- [ ] Errors: backend stopped mid-choose and mid-create; a 409 from a second tab.
- [ ] Tab through every control on the page: focus ring visible on paper; focus lands on "Page n of max" after each turn.
- [ ] Reduced motion: no quill, cross-fades only, everything still works.
- [ ] No horizontal scroll during turns at 320 px; decorations never cover the book, the title or the controls.
- [ ] Contrast spot-checked against `SPEC-3.md`. Screenshots of each moment for the human.

## Step 9: Docs (needs the human's OK)
- [ ] `SPEC.md`: storybox line says "Page n of max", the book, the action line; node view lists the two new fields; loading line points to `SPEC-3.md`.
- [ ] `CLAUDE.md`: mention `SPEC-3.md` next to `SPECS-2.md`; theme rules gain `page-*` tokens and `Quill`; the readability
  line notes passages may step down to 16px to fit the page (R23).
- [ ] `README.md`: one paragraph and a screenshot of the book.
- [x] Deploy: backend first (additive), then the frontend.

## Step 10: Go back on the left side of the book (D18)
- [x] `Book.tsx`: a `back` slot, drawn outside the faded mask at the foot of the spine, only while paper lies on the left.
- [x] `StoryView.tsx`: passes the tab (round "‹" on phones, "‹ Back" from 640px, "Go back a page" for screen
  readers), hidden while busy; the "↑ Go back" button under the book is removed.
- [x] `SPEC-3.md` (D7, D18, the flow table, R16, an edge case) and the README's "How to play".

**Done when:** `./test.sh` passes; in both themes at 320, 390, 640 and 1280px the tab is at least 44px, never
covers text, causes no sideways scroll, is absent on page 1 and during turns, shows its focus ring from the
keyboard, and turns back with focus on "Page n of max"; its text contrast is at least 4.5:1 (measured 7.1–7.8:1).

## Risks
- **Animations and focus.** A turn moves DOM while the player may be tabbing. Controls are disabled during turns
  and the leaf is `inert`, and focus is set only after the turn settles (R17, R20).
- **Fit-to-page text.** Shrinking runs after layout, so a page could flash at 18px first. `useLayoutEffect` runs
  before paint, and the leaf copies use the size already worked out.
- **Measuring text for the quill.** Canvas measuring can differ slightly from the browser's own wrapping. The
  animated lines are only shown while writing; afterwards the page shows the normal wrapped text, so a small
  jump is possible. Checked in Step 8; if it's visible, keep the measured lines until the next page.
- **Waiting on the pen.** The quill must never make a fast response feel slow, hence the 2.5 s / 4 s caps.
- **`StoryView` grows.** It holds the whole flow. `StoryPage`, `Book` and `QuillWriting` take the rendering and
  animation out of it; if it's still too long after Step 7, split the create flow into its own component (asked first).
- **Light paper in dark themes.** New tokens could be used by mistake off the page. The rule (TH10) says `page-*`
  only inside the book.

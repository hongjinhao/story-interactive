# Theme: Halloween

The original look, written up as it is today. PLAN-2 moves it onto the theme system without changing
how it looks (only the token names change, e.g. `pumpkin` → `accent`).

## Identity
| Field | Value |
|---|---|
| id | `halloween` |
| Label | Halloween ("Halloween stories") |
| Festival | Oct 31 |
| Default window | Jan 2 – Nov 7 (with Christmas as the only other festival) |
| Status | live (moves onto the theme system in PLAN-2) |
| One-line feel | A haunted night: ghosts, cobwebs and spiders, pumpkin light, spooky but readable |

Also the backend's default theme for `POST /api/stories` without `theme`, and the bank all stories made
before PLAN-2 belong to.

## Palette
| Token (old name) | Hex | Use | Notes |
|---|---|---|---|
| `bg` (`night`) | `#0d0a14` | page background | |
| `surface` (`crypt`) | `#1a1325` | cards, panels | |
| `edge` (`crypt-edge`) | `#2e2340` | decorative card borders | decorative |
| `field` (`tomb`) | `#75649a` | input and secondary button borders | |
| `ink` (`bone`) | `#f2ecdf` | main text | |
| `muted` (`mist`) | `#b8aecb` | secondary text, unselected picker icons | |
| `accent` (`pumpkin`) | `#ff8c1a` | primary buttons, focus ring, headings | |
| `success` (`slime`) | `#8fe36b` | explored marker | |
| `danger` (`blood`) | `#ff6b6b` | errors | |
| extras | none | | |

Contrast:
| Pair | Minimum | Ratio |
|---|---|---|
| `ink` on `bg` | 7:1 | 16.7:1 |
| `ink` on `surface` | 7:1 | 15.3:1 |
| `muted` on `surface` | 4.5:1 | 8.6:1 |
| `accent` on `surface` | 4.5:1 | 7.7:1 |
| `success` on `surface` | 4.5:1 | 11.5:1 |
| `danger` on `surface` | 4.5:1 | 6.5:1 |
| `bg` text on `accent` | 4.5:1 | 8.4:1 |
| `field` on `surface` | 3:1 | 3.5:1 |
| `field` on `bg` | 3:1 | 3.8:1 |
| `muted` @ 70% on `bg` | 3:1 | 5.0:1 |

## Paper and cover (`SPEC-3.md`, TH8, TH10)
The book's pages are the one light surface in the app. These tokens are used only inside the book (TH10).

| Token | Hex | Use | Notes |
|---|---|---|---|
| `page` | `#efe4cc` | paper | |
| `page-back` | `#e2d4b6` | back of a turning page, the left-side strip | decorative |
| `page-ink` | `#2b2118` | passage and body text on paper | |
| `page-muted` | `#5e5146` | secondary text on paper | |
| `page-edge` | `#7a6650` | input and button borders on paper | |
| `page-shade` | `#ddd1b9` | the grey action box | |
| `page-accent` | `#5b2a86` | story title, primary button, focus ring on paper | |
| `page-success` | `#2f6b2a` | explored marker on paper | |
| `page-danger` | `#a3242a` | errors on paper | |
| `book-cover` | `#2a1838` | the book cover | decorative |
| `book-cover-deep` | `#160c20` | the cover's shadow and inside | decorative |
| `foil` | `#ffb25e` | writing and frame on the cover | |

Contrast:
| Pair | Minimum | Ratio |
|---|---|---|
| `page-ink` on `page` | 7:1 | 12.5:1 |
| `page-ink` on `page-shade` (action box) | 7:1 | 10.4:1 |
| `page-muted` on `page` | 4.5:1 | 6.1:1 |
| `page-accent` on `page` | 4.5:1 | 7.8:1 |
| `page-success` on `page` | 4.5:1 | 5.1:1 |
| `page-danger` on `page` | 4.5:1 | 5.9:1 |
| `page` text on `page-accent` (primary button) | 4.5:1 | 7.8:1 |
| `page-edge` on `page` | 3:1 | 4.3:1 |
| `foil` on `book-cover` | 4.5:1 | 9.2:1 |

Old parchment with sepia ink; `page-accent` is a deep violet so the paper keeps the haunted feel. `foil` is the pumpkin glow on a midnight-purple cover.

## Type
| Role | Font |
|---|---|
| Display (headings only) | Creepster, fallback `"Lora", Georgia, serif` |
| Passages | Lora 18px |
| Body, buttons, inputs | system sans |

## Icons
| Component | What it shows | Colours |
|---|---|---|
| `PickerIcon` (`Pumpkin.tsx`, new) | Flat pumpkin: slightly squashed round body, two shallow rib notches, short stem. No face. | `currentColor` |
| `Icon` (`Ghost.tsx`) | Peeks over the book. Sheet ghost with a round head, wavy hem, two eyes and a mouth | `ink` body, `bg` face |
| `CardCorner` (`Cobweb.tsx`) | Corner cobweb, rotated into the card's bottom-right corner | `ink` strokes, 15% |
| `Quill` (`Quill.tsx`, TH32) | A gloved hand holding a dark crow quill, nib at the bottom-left. Shown only while writing. | glove `muted` with a `page-ink` outline; feather `page-ink` with a `muted` vane line; `foil` nib |

## Decorations (`HauntedDecor.tsx`)
| Element | Where | Size / count | Opacity | Motion |
|---|---|---|---|---|
| Cobwebs | top-left and top-right page corners, every width (right one mirrored) | 2: 32px, 80px from sm, 128px from md, 160px from lg (kept clear of the title, TH14) | 25% | none |
| Spiders on threads | top of the page, side margins (lg+) | 3, threads 64–176px | full (`muted` body, `accent` eyes) | `dangle`, 5 s, staggered |
| Ghosts | side margins (lg+) | 4, 32–56px | 50–60% | `float`, 7 s, staggered |
| Ghosts | header corners (below lg) | 2, 20–24px | 50% | `float` |
| Ghost peeking over the book | book top edge | 1, 40px | 80% | `float` |

Keyframes: `float` (bob up 12px and back), `dangle` (sway ±4° from the top).

## Wording
| Key | Where it shows | Text |
|---|---|---|
| `tagline` | under the title | Choose your own adventure… if you dare. |
| `intro` | under "Begin a new tale" | Describe an idea and the spirits will write the story, one choice at a time. Each tale lasts 5 to 10 turns: pick one of two paths, or type your own. |
| `ideaPlaceholder` | idea box | A lighthouse keeper hears knocking from beneath the waves… |
| `createButton` | create button | Summon a tale |
| `creating` | status line while creating | Summoning your tale… |
| `choosing` | blank page and status line while choosing | The tale unfolds… |
| `slow` | status line after 10 s | The spirits are slow tonight… still working. |
| `customPlaceholder` | custom action box | Whistle back at the raven… |
| `listHeading` | home list heading | Tales already told |
| `listLoading` | while the list loads | Gathering the tales… |
| `emptyList` | bank has no stories | No tales haunt this place yet… summon the first one above. |
| `unreachable` | backend-down banner | The spirits can't be reached |

The `intro` is the one line over 90 characters (TH22). It's kept as is, because the second sentence is
how the app explains the rules.

## Narrator mood
`MOODS["halloween"]`:
> Lean eerie and atmospheric: shadows, mystery, a delicious chill, never graphic.

This replaces today's shared line "Lean eerie and atmospheric where it suits the player's idea." so the
tone should stay the same.

Trial stories (PLAN-2 Step 9, 2026-11-20):
| Idea | Kind | Mood shows? | Format unchanged? |
|---|---|---|---|
| A trip to the mountains | neutral | yes: mist, "an eerie quiet", a glow pulsing like a heartbeat (story 7) | yes: 98 words, 2 command options |
| A haunted lighthouse | matching | yes: ghostly lullaby, a watchful presence; resolves gently, never graphic (story 5, played to The End + a custom ending) | yes: 95–145 words; the custom ending ran 159 (shared-prompt drift) |
| A sunny beach picnic | opposite | lightly: stays sunny, with "a faint unease" at the end. The idea wins (TH25) (story 8) | yes, 79 words (one under), 2 options |

## Content check
- Trademarks avoided: no Jack Skellington, Hocus Pocus, Ghostbusters or other film imagery. Generic ghosts, spiders, cobwebs and pumpkins only.
- Cultural notes: secular, folklore Halloween only.

## Build checklist (PLAN-2)
- [x] Token rename (Step 5), no visible change
- [x] Moved to `frontend/src/themes/halloween/` + `THEMES` entry with the wording above (Step 6)
- [x] `Pumpkin.tsx` picker icon (Step 7)
- [x] Mood line in `llm.MOODS` (Step 1)
- [x] Trial stories done and noted above
- [ ] Browser checks (Step 9): all pass except TH14. The small header ghosts (below lg) touch the title/tagline at 414px. Open question, pre-dates PLAN-2. (Corner cobwebs fixed: scaled per breakpoint.)

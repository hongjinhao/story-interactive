# Theme: <Name>

<!-- Copy this file to theme-specs/<id>.md and fill in every section. Rules TH1–TH32 are in README.md.
     Get the sheet approved before building. -->

## Identity
| Field | Value |
|---|---|
| id | `<lowercase-id>` (TH1) |
| Label | <Name> (used in "<Name> stories" for the picker label) |
| Festival | <Mon DD>, or "none (pick-only)" (TH4, TH5) |
| Default window | <Mon DD> – <Mon DD> (TH6), or "never (pick-only)" |
| Status | proposed / approved / live / retired |
| One-line feel | <e.g. "Cosy winter fireside: snow, gold light, kindness"> |

## Palette (TH7–TH10)
| Token | Hex | Use | Notes |
|---|---|---|---|
| `bg` | | page background | |
| `surface` | | cards, panels | |
| `edge` | | decorative card borders | decorative |
| `field` | | input and secondary button borders | |
| `ink` | | main text | |
| `muted` | | secondary text, unselected picker icons | |
| `accent` | | primary buttons, focus ring, headings | |
| `success` | | explored marker | |
| `danger` | | errors | |
| extras | | <decoration only> | decorative |

Contrast (fill in measured ratios, TH8):
| Pair | Minimum | Ratio |
|---|---|---|
| `ink` on `bg` | 7:1 | |
| `ink` on `surface` | 7:1 | |
| `muted` on `surface` | 4.5:1 | |
| `accent` on `surface` | 4.5:1 | |
| `success` on `surface` | 4.5:1 | |
| `danger` on `surface` | 4.5:1 | |
| `bg` text on `accent` | 4.5:1 | |
| `field` on `surface` | 3:1 | |
| `field` on `bg` | 3:1 | |
| `muted` @ 70% on `bg` | 3:1 | |

## Paper and cover (`SPEC-3.md`, TH8, TH10)
Used only inside the book (TH10). Light paper, dark ink.
| Token | Hex | Use | Notes |
|---|---|---|---|
| `page` | | paper | |
| `page-back` | | back of a turning page, the left-side strip | decorative |
| `page-ink` | | passage and body text on paper | |
| `page-muted` | | secondary text on paper | |
| `page-edge` | | input and button borders on paper | |
| `page-shade` | | the grey action box | |
| `page-accent` | | story title, primary button, focus ring on paper | |
| `page-success` | | explored marker on paper | |
| `page-danger` | | errors on paper (TH9: unlike any theme colour) | |
| `cover` | | the book cover | decorative |
| `cover-deep` | | the cover's shadow and inside | decorative |
| `foil` | | writing and frame on the cover | |

Contrast (fill in measured ratios, TH8):
| Pair | Minimum | Ratio |
|---|---|---|
| `page-ink` on `page` | 7:1 | |
| `page-ink` on `page-shade` (action box) | 7:1 | |
| `page-muted` on `page` | 4.5:1 | |
| `page-accent` on `page` | 4.5:1 | |
| `page-success` on `page` | 4.5:1 | |
| `page-danger` on `page` | 4.5:1 | |
| `page` text on `page-accent` (primary button) | 4.5:1 | |
| `page-edge` on `page` | 3:1 | |
| `foil` on `cover` | 4.5:1 | |

## Type (TH11, TH12)
| Role | Font |
|---|---|
| Display (headings only) | <Google Font>, fallback `"Lora", Georgia, serif` |
| Passages | Lora 18px, down to 16px only to fit the page (fixed, R23) |
| Body, buttons, inputs | system sans (fixed) |

## Icons (TH18–TH20, TH32)
| Component | What it shows | Colours |
|---|---|---|
| `PickerIcon` | <flat silhouette, describe the shape> | `currentColor` only |
| `Icon` | <peeks over the book> | |
| `CardCorner` | <corner ornament> | |
| `Quill` | <hand holding a pen, nib at the bottom-left; readable on `page` and `cover`> | |

## Decorations (TH13–TH17)
| Element | Where | Size / count | Opacity | Motion (keyframe, duration) |
|---|---|---|---|---|
| | top corners | | | |
| | side margins (lg+) | | | |
| | header corners (below lg) | at most 2–3 | | |

New keyframes: <name: what it does, or "none">

## Wording (TH21–TH23)
| Key | Where it shows | Text |
|---|---|---|
| `tagline` | under the title (≤ 60) | |
| `intro` | under "Begin a new tale" | |
| `ideaPlaceholder` | idea box | |
| `createButton` | create button (≤ 20) | |
| `creating` | status line while creating | |
| `choosing` | blank page and status line while choosing | |
| `slow` | status line after 10 s | |
| `customPlaceholder` | custom action box | |
| `listHeading` | home list heading | |
| `listLoading` | while the list loads | |
| `emptyList` | bank has no stories | |
| `unreachable` | backend-down banner, before the status | |

## Narrator mood (TH24–TH27)
`MOODS["<id>"]`:
> Lean …

Trial stories (TH27):
| Idea | Kind | Mood shows? | Format unchanged? |
|---|---|---|---|
| | neutral | | |
| | matching | | |
| | opposite | | |

## Content check (TH28, TH29)
- Trademarks avoided: <list anything considered and left out>
- Cultural notes: <or "n/a">

## Build checklist
- [ ] Sheet approved
- [ ] Backend: id in `schemas.ThemeId`, line in `llm.MOODS`; `./test.sh`
- [ ] `index.css`: `[data-theme='<id>']` block with all tokens (incl. `page-*`, `cover`, `cover-deep`, `foil`) + extras; new keyframes in `@theme`
- [ ] `index.html`: display font added to the Google Fonts link
- [ ] `frontend/src/themes/<id>/`: `PickerIcon`, `Icon`, `CardCorner`, `Decor`, `Quill`
- [ ] `themes.ts`: `ThemeId` union + `THEMES` entry (label, festival, components, copy)
- [ ] Default windows in the other theme sheets updated (a new festival shortens a neighbour's window)
- [ ] Trial stories done and noted above
- [ ] Browser checks (PLAN-2 Step 9) at 1280 / 390 / 320 px, keyboard, reduced motion
- [ ] Row added to `theme-specs/README.md`

# Theme: <Name>

<!-- Copy this file to theme-specs/<id>.md and fill in every section. Rules TH1–TH31 are in README.md.
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

## Type (TH11, TH12)
| Role | Font |
|---|---|
| Display (headings only) | <Google Font>, fallback `"Lora", Georgia, serif` |
| Passages | Lora 18px (fixed) |
| Body, buttons, inputs | system sans (fixed) |

## Icons (TH18–TH20)
| Component | What it shows | Colours |
|---|---|---|
| `PickerIcon` | <flat silhouette, describe the shape> | `currentColor` only |
| `Icon` | <loader + story-card peeker> | |
| `CardCorner` | <corner ornament> | |

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
| `creating` | loader while creating | |
| `choosing` | loader while choosing | |
| `slow` | loader after 10 s | |
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
- [ ] `index.css`: `[data-theme='<id>']` block with all tokens + extras; new keyframes in `@theme`
- [ ] `index.html`: display font added to the Google Fonts link
- [ ] `frontend/src/themes/<id>/`: `PickerIcon`, `Icon`, `CardCorner`, `Decor`
- [ ] `themes.ts`: `ThemeId` union + `THEMES` entry (label, festival, components, copy)
- [ ] Default windows in the other theme sheets updated (a new festival shortens a neighbour's window)
- [ ] Trial stories done and noted above
- [ ] Browser checks (PLAN-2 Step 9) at 1280 / 390 / 320 px, keyboard, reduced motion
- [ ] Row added to `theme-specs/README.md`

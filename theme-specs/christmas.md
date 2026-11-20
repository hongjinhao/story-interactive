# Theme: Christmas

## Identity
| Field | Value |
|---|---|
| id | `christmas` |
| Label | Christmas ("Christmas stories") |
| Festival | Dec 25 |
| Default window | Nov 8 – Jan 1 |
| Status | proposed (built in PLAN-2 Step 8) |
| One-line feel | A cosy winter night by the fire: pine green, snow and gold light, warm and hopeful |

## Palette
| Token | Hex | Use | Notes |
|---|---|---|---|
| `bg` | `#0b1612` | page background | pine night |
| `surface` | `#13241d` | cards, panels | fir |
| `edge` | `#24402f` | decorative card borders | decorative |
| `field` | `#6f9a80` | input and secondary button borders | |
| `ink` | `#f5f1e6` | main text | snow |
| `muted` | `#b9cbbf` | secondary text, unselected picker icons | |
| `accent` | `#f2c14e` | primary buttons, focus ring, headings | gold |
| `success` | `#9fd8ff` | explored marker | frost |
| `danger` | `#ff8a80` | errors | coral, kept apart from the holly red |
| `holly` | `#d7263d` | berries, bauble stripes | decorative only |

Contrast:
| Pair | Minimum | Ratio |
|---|---|---|
| `ink` on `bg` | 7:1 | 16.4:1 |
| `ink` on `surface` | 7:1 | 14.3:1 |
| `muted` on `surface` | 4.5:1 | 9.5:1 |
| `accent` on `surface` | 4.5:1 | 9.6:1 |
| `success` on `surface` | 4.5:1 | 10.6:1 |
| `danger` on `surface` | 4.5:1 | 7.1:1 |
| `bg` text on `accent` | 4.5:1 | 11.0:1 |
| `field` on `surface` | 3:1 | 5.1:1 |
| `field` on `bg` | 3:1 | 5.8:1 |
| `muted` @ 70% on `bg` | 3:1 | 5.8:1 |

TH9: `danger` (coral `#ff8a80`) is lighter and pinker than `holly` (`#d7263d`), and holly never
appears as text, so an error can't be mistaken for decoration.

## Type
| Role | Font |
|---|---|
| Display (headings only) | Mountains of Christmas (700), fallback `"Lora", Georgia, serif` |
| Passages | Lora 18px |
| Body, buttons, inputs | system sans |

Check at build time: "The End" at `text-5xl` and a long story title at `text-2xl` stay readable. If
Mountains of Christmas is too thin at 400, use 700 everywhere.

## Icons
| Component | What it shows | Colours |
|---|---|---|
| `PickerIcon` (`Tree.tsx`) | Flat Christmas tree: three stacked triangles getting wider downwards, a small square trunk. No star, baubles or outline. | `currentColor` |
| `Icon` (`Bauble.tsx`) | Round bauble with a small cap and loop, one horizontal stripe | `accent` body, `holly` stripe, `muted` cap |
| `CardCorner` (`Holly.tsx`) | Two holly leaves and three berries | `field` leaves, `holly` berries, ≤ 20% |

## Decorations (`FestiveDecor.tsx`)
| Element | Where | Size / count | Opacity | Motion |
|---|---|---|---|---|
| Holly sprigs | top-left and top-right page corners (right one mirrored) | 2, 96px (160px from sm) | 25% | none |
| Baubles on threads | top of the page, side margins (lg+) | 3, threads 64–176px | 70–90% | `dangle`, 5 s, staggered |
| Snowflakes | side margins only (lg+) | 8–10, 12–28px | 30–60% | `snowfall`, 10–18 s, staggered |
| Snowflakes | header corners (below lg) | 2, 16–20px | 40% | none |
| Bauble peeking over the story card | card top edge | 1, 40px | 80% | `dangle` |

New keyframes:
- `snowfall`: fall from just above the top to below the page's visible area with a slight sideways
  drift, linear, then repeat. Flakes are in the margins, so they never pass behind text.
- `twinkle`: opacity 0.4 ↔ 1, 4 s. Optional, for 2–3 flakes only.

## Wording
| Key | Where it shows | Text |
|---|---|---|
| `tagline` | under the title | Choose your own adventure by the fireside. |
| `intro` | under "Begin a new tale" | Describe an idea and the elves will write the story, one choice at a time. Each tale lasts 5 to 10 turns: pick one of two paths, or type your own. |
| `ideaPlaceholder` | idea box | A lost reindeer, a snowed-in inn, a toy that wakes at midnight… |
| `createButton` | create button | Spin a tale |
| `creating` | loader while creating | Wrapping up your tale… |
| `choosing` | loader while choosing | The tale unfolds… |
| `slow` | loader after 10 s | The sleigh is running late… still working. |
| `customPlaceholder` | custom action box | Knock on the cabin door… |
| `listHeading` | home list heading | Tales by the fire |
| `listLoading` | while the list loads | Gathering the tales… |
| `emptyList` | bank has no stories | No tales by the tree yet… spin the first one above. |
| `unreachable` | backend-down banner | The North Pole can't be reached |

## Narrator mood
`MOODS["christmas"]`:
> Lean warm and festive: winter wonder, snow, kindness and gentle suspense, with a hopeful tone.

Trial stories (to do in PLAN-2 Step 9):
| Idea | Kind | Mood shows? | Format unchanged? |
|---|---|---|---|
| A trip to the mountains | neutral | | |
| A lost reindeer on Christmas Eve | matching | | |
| A haunted lighthouse | opposite | | |

## Content check
- Trademarks avoided: no Rudolph (trademarked), Grinch, Frosty, Elf on the Shelf, or brand imagery
  (e.g. a specific soft-drink Santa). Generic reindeer, elves, Santa, snowmen and trees are fine.
- Cultural notes: kept to the public, festive side (snow, lights, gifts, kindness, folklore). No nativity
  or other religious symbols in decorations or the mood line. Players can still write any story they like.

## Build checklist (PLAN-2)
- [ ] Sheet approved
- [ ] Backend: `"christmas"` in `schemas.ThemeId`, line in `llm.MOODS` (Steps 1–2)
- [ ] `index.css`: `[data-theme='christmas']` block + `holly`; `snowfall`, `twinkle` in `@theme` (Step 8)
- [ ] `index.html`: Mountains of Christmas in the Google Fonts link (Step 8)
- [ ] `frontend/src/themes/christmas/`: `Tree`, `Bauble`, `Holly`, `Snowflake`, `FestiveDecor` (Step 8)
- [ ] `themes.ts`: `ThemeId` + `THEMES` entry with `festival: { month: 12, day: 25 }` and the wording above (Step 8)
- [ ] Trial stories done and noted above
- [ ] Browser checks (Step 9) at 1280 / 390 / 320 px, keyboard, reduced motion

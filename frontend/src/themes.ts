// The theme list (SPECS-2.md). Each theme's look and wording come from its sheet in theme-specs/.
// Adding a theme: follow theme-specs/README.md. Components read their text and icons from a Theme
// prop, so none of them needs to change.
import type { ComponentType } from 'react'
import type { ThemeId } from './api.ts'
import CardCobweb from './themes/halloween/CardCobweb.tsx'
import Ghost from './themes/halloween/Ghost.tsx'
import HauntedDecor from './themes/halloween/HauntedDecor.tsx'

type IconComponent = ComponentType<{ className?: string }>

export type Theme = {
  id: ThemeId
  label: string // "Halloween"; the picker says "<label> stories"
  festival?: { month: number; day: number } // 1-based; without one the theme is never picked by date
  Decor: ComponentType // page background layer
  Icon: IconComponent // loader, and peeking over the story card
  CardCorner: IconComponent // ornament in the story card's bottom-right corner (caller positions it)
  copy: {
    tagline: string
    intro: string
    ideaPlaceholder: string
    createButton: string
    creating: string
    choosing: string
    slow: string
    customPlaceholder: string
    listHeading: string
    listLoading: string
    emptyList: string
    unreachable: string // followed by "(<status>). Start the backend..."
  }
}

export const THEMES: Theme[] = [
  {
    id: 'halloween',
    label: 'Halloween',
    festival: { month: 10, day: 31 },
    Decor: HauntedDecor,
    Icon: Ghost,
    CardCorner: CardCobweb,
    copy: {
      tagline: 'Choose your own adventure… if you dare.',
      intro:
        'Describe an idea and the spirits will write the story, one choice at a time. Each tale lasts 5 to 10 turns: pick one of two paths, or type your own.',
      ideaPlaceholder: 'A lighthouse keeper hears knocking from beneath the waves…',
      createButton: 'Summon a tale',
      creating: 'Summoning your tale…',
      choosing: 'The tale unfolds…',
      slow: 'The spirits are slow tonight… still working.',
      customPlaceholder: 'Whistle back at the raven…',
      listHeading: 'Tales already told',
      listLoading: 'Gathering the tales…',
      emptyList: 'No tales haunt this place yet… summon the first one above.',
      unreachable: "The spirits can't be reached",
    },
  },
]

export const FALLBACK_THEME: ThemeId = 'halloween' // only used if no theme has a festival

// The theme with this id, or null for anything else (unknown id, wrong type).
export function findTheme(id: unknown): Theme | null {
  return THEMES.find((theme) => theme.id === id) ?? null
}

const DAYS_AFTER_FESTIVAL = 7

// The default theme for a date (SPECS-2.md "Seasonal default"): each festival's season ends a week
// after it, and the theme whose season ends soonest on or after today wins. Local calendar dates only.
export function seasonalTheme(today: Date): Theme {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let best: { theme: Theme; end: Date } | null = null
  for (const theme of THEMES) {
    if (!theme.festival) continue
    for (const year of [day.getFullYear() - 1, day.getFullYear(), day.getFullYear() + 1]) {
      const end = new Date(year, theme.festival.month - 1, theme.festival.day + DAYS_AFTER_FESTIVAL)
      if (end >= day && (best === null || end < best.end)) best = { theme, end }
    }
  }
  return best?.theme ?? findTheme(FALLBACK_THEME) ?? THEMES[0]
}

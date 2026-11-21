import Bauble from './Bauble.tsx'
import Holly from './Holly.tsx'
import Snowflake from './Snowflake.tsx'

const still = 'motion-reduce:animate-none' // players who turn off animations get a still scene

// A bauble hanging from the top of the screen on a thread, swaying from the top.
function HangingBauble({ className, thread }: { className: string; thread: string }) {
  return (
    <div className={`absolute top-0 hidden origin-top animate-dangle flex-col items-center lg:flex ${still} ${className}`}>
      <div className={`w-px bg-ink/30 ${thread}`} />
      <Bauble className="-mt-1 w-7 opacity-80" />
    </div>
  )
}

// Snowflakes in the side margins (lg+). Each drifts down through a band around where it sits, fading
// in and out, so with reduced motion it simply rests there. [left/right, top, size, opacity, timing]
const FLAKES = [
  ['left-[3%]', 'top-[8%]', 'w-5', 'opacity-50', '[animation-duration:14s]'],
  ['left-[9%]', 'top-[30%]', 'w-3', 'opacity-40', '[animation-duration:11s] [animation-delay:-4s]'],
  ['left-[14%]', 'top-[52%]', 'w-6', 'opacity-55', '[animation-duration:17s] [animation-delay:-9s]'],
  ['left-[5%]', 'top-[70%]', 'w-4', 'opacity-45', '[animation-duration:13s] [animation-delay:-6s]'],
  ['right-[4%]', 'top-[14%]', 'w-6', 'opacity-55', '[animation-duration:16s] [animation-delay:-2s]'],
  ['right-[12%]', 'top-[38%]', 'w-3', 'opacity-40', '[animation-duration:12s] [animation-delay:-7s]'],
  ['right-[7%]', 'top-[58%]', 'w-5', 'opacity-50', '[animation-duration:18s] [animation-delay:-11s]'],
  ['right-[15%]', 'top-[76%]', 'w-4', 'opacity-35', '[animation-duration:10s] [animation-delay:-3s]'],
]

// Holly, baubles and snow behind the page. Same layer rules as HauntedDecor (theme-specs TH13–TH16):
// under the z-10 content, ignores the mouse, scrolls with the page, most of it in the side margins.
export default function FestiveDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Holly is drawn for a bottom-right corner: turn it for the top corners. */}
      <Holly className="absolute top-0 left-0 w-24 rotate-180 opacity-25 sm:w-40" />
      <Holly className="absolute top-0 right-0 w-24 -scale-y-100 opacity-25 sm:w-40" />

      <HangingBauble className="left-[5%]" thread="h-28" />
      <HangingBauble className="right-[9%] [animation-delay:-2s]" thread="h-44" />
      <HangingBauble className="right-[3%] [animation-delay:-3.5s]" thread="h-16" />

      {FLAKES.map(([side, top, size, opacity, timing]) => (
        <Snowflake
          key={side + top}
          className={`absolute hidden animate-snowfall lg:block ${still} ${side} ${top} ${size} ${opacity} ${timing}`}
        />
      ))}

      {/* below lg: two still flakes in the header's top corners, beside the centred title */}
      <Snowflake className="absolute top-24 left-3 w-4 opacity-40 lg:hidden" />
      <Snowflake className="absolute top-28 right-4 w-5 opacity-40 lg:hidden" />
    </div>
  )
}

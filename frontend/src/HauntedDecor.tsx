import Cobweb from './Cobweb.tsx'
import Ghost from './Ghost.tsx'

const still = 'motion-reduce:animate-none' // players who turn off animations get a still scene

// A spider hanging from the top of the screen on a thread, swaying from the top.
function Spider({ className, thread }: { className: string; thread: string }) {
  return (
    <div className={`absolute top-0 hidden origin-top animate-dangle flex-col items-center lg:flex ${still} ${className}`}>
      <div className={`w-px bg-bone/30 ${thread}`} />
      <svg viewBox="0 0 40 32" className="-mt-1 w-8">
        <g fill="none" strokeWidth={1.5} strokeLinecap="round" className="stroke-mist">
          <path d="M18 14Q10 4 3 8M17 17Q8 12 1 16M17 20Q8 20 2 26M18 23Q12 28 6 31" />
          <path d="M22 14Q30 4 37 8M23 17Q32 12 39 16M23 20Q32 20 38 26M22 23Q28 28 34 31" />
        </g>
        <ellipse cx="20" cy="19" rx="7" ry="8" className="fill-mist" />
        <circle cx="20" cy="10" r="4" className="fill-mist" />
        <circle cx="18.5" cy="9.5" r="1" className="fill-pumpkin" />
        <circle cx="21.5" cy="9.5" r="1" className="fill-pumpkin" />
      </svg>
    </div>
  )
}

// Ghosts, cobwebs and spiders behind the page. The layer sits under the z-10 content and ignores
// the mouse, so it only shows through empty background. It scrolls with the page (absolute, not
// fixed) so nothing drifts behind text. Spiders and most ghosts live in the side margins outside the
// 768px column (lg and up); below that, two small ghosts sit in the header's text-free top corners.
export default function HauntedDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <Cobweb className="absolute top-0 left-0 w-24 opacity-25 sm:w-40" />
      <Cobweb className="absolute top-0 right-0 w-24 -scale-x-100 opacity-25 sm:w-40" />

      <Spider className="left-[5%]" thread="h-28" />
      <Spider className="right-[9%] [animation-delay:-2s]" thread="h-44" />
      <Spider className="right-[3%] [animation-delay:-3.5s]" thread="h-16" />

      {/* below lg: in the header's top corners, beside the centred title */}
      <Ghost className={`absolute top-24 left-2 w-6 animate-float opacity-50 lg:hidden ${still}`} />
      <Ghost className={`absolute top-28 right-3 w-5 animate-float opacity-50 [animation-delay:-3s] lg:hidden ${still}`} />

      {/* lg and up: in the margins */}
      <Ghost className={`absolute top-[34%] left-[4%] hidden w-12 animate-float opacity-60 lg:block ${still}`} />
      <Ghost className={`absolute top-[68%] left-[8%] hidden w-8 animate-float opacity-50 [animation-delay:-4s] lg:block ${still}`} />
      <Ghost className={`absolute top-[26%] right-[5%] hidden w-10 animate-float opacity-55 [animation-delay:-2s] lg:block ${still}`} />
      <Ghost className={`absolute top-[56%] right-[3%] hidden w-14 animate-float opacity-60 [animation-delay:-5s] lg:block ${still}`} />
    </div>
  )
}

/** The match-day flow as a progress bar: where this match is right now. Pure markup. */
const STEPS = [
  { n: 1, label: "Get the team", hint: "The agent builds the XI" },
  { n: 2, label: "Play it in Dream11", hint: "You submit it yourself" },
  { n: 3, label: "Enter real points", hint: "After the match" },
  { n: 4, label: "Agent learns", hint: "Weights update" },
];

export default function StepBar({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  // current = the active step; 5 means every step is done
  return (
    <nav aria-label="Match day progress" className="card sticky top-[62px] z-30 px-3 py-2.5 backdrop-blur sm:px-5">
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((s, i) => {
          const done = s.n < current;
          const active = s.n === current;
          return (
            <li key={s.n} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-all ${
                  done ? "bg-good text-white" : active ? "anim-pulse bg-gold text-navy" : "bg-bg text-muted ring-1 ring-line"
                }`}
              >
                {done ? "✓" : s.n}
              </span>
              <span className="hidden min-w-0 leading-tight sm:block">
                <span className={`block truncate text-xs font-semibold ${active ? "text-ink" : done ? "text-good" : "text-muted"}`}>{s.label}</span>
                <span className="block truncate text-[10px] text-muted">{s.hint}</span>
              </span>
              {i < STEPS.length - 1 && <span className={`mx-1 h-0.5 flex-1 rounded-full transition-colors ${done ? "bg-good" : "bg-line"}`} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-center text-[11px] font-medium text-muted sm:hidden">
        {current > 4 ? "All steps done" : `Step ${current} of 4: ${STEPS[current - 1].label}`}
      </p>
    </nav>
  );
}

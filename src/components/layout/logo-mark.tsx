// NBA Games mark: "X's and O's" — the ball as the O, a chalk X, and the play arrow between them,
// drawn slightly off-true like a coach's hand on the board. Colours come from CSS tokens
// (.logo-mark__*). The same drawing is the favicon: src/app/icon.svg.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={["logo-mark", className].filter(Boolean).join(" ")}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          className="logo-mark__ball"
          strokeWidth="3"
          d="M26 16.6C26 22.6 21.4 27.2 15.6 27 9.9 26.8 5.9 22.3 6 16.8 6.1 11.2 10.4 7 16.1 7c5.1.1 9.4 3.6 10 8.5l.2 2.7"
        />
        <path
          className="logo-mark__seam"
          strokeWidth="1.5"
          d="M16 7.2c1.4 4.8 1.3 14.8-.3 19.6M6.1 17c5.9-1.2 13.9-1 19.9.4M9.2 9.8c3.2 3.8 3.2 10.8-.2 14.6M22.9 9.9c-3.1 3.9-3 10.5.3 14.4"
        />
        <path
          className="logo-mark__play"
          strokeWidth="2"
          d="M37 28c1-7-2-12.5-7.5-14M33 18.2 29.5 14l5.2-1.9"
        />
        <path className="logo-mark__x" strokeWidth="3.2" d="M31.5 31 42 41.5M41.6 30.6 31.8 41.8" />
      </g>
    </svg>
  );
}

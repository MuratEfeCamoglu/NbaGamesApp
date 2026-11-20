/**
 * Home hero art: a half-court set play chalked on the board (Xs, Os, a pass, a screen and a
 * backdoor cut) that draws itself once on load. Pure SVG + CSS (globals.css `.play-diagram`);
 * every stroke has pathLength="1" so one dash rule animates all of them. Coordinates are
 * deliberately a little off-true: the goal is a coach's hand, not a CAD drawing.
 * Decorative (aria-hidden); the note is short and its meaning is not needed to use the page.
 */
export function PlayDiagram({ note }: { note: string }) {
  return (
    <figure className="play-diagram" data-component="PlayDiagram" aria-hidden="true">
      <svg className="play-diagram__svg" viewBox="0 0 360 290" focusable="false">
        <defs>
          {/* Wobble the lines, then eat into them with fine grain so they read as chalk. */}
          <filter id="pd-chalk" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="2.6" result="wobbly" />
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.45"
              result="grain"
            />
            <feComposite in="wobbly" in2="grain" operator="in" />
          </filter>
        </defs>

        <g filter="url(#pd-chalk)">
          {/* Court: baseline, lane, free-throw circle, three-point line, rim */}
          <g className="play-diagram__court">
            <path pathLength={1} data-step="0" d="M14 21 C120 19.5 240 22.5 347 20" />
            <path pathLength={1} data-step="0" d="M133 21 L134.5 151 L227 149.5 L225.5 20.5" />
            <path pathLength={1} data-step="0" d="M150 150 C151 116 210 113 211 150" />
            <path
              pathLength={1}
              data-step="0"
              className="play-diagram__dash"
              d="M151 151 C153 185 209 186 210 150"
            />
            <path
              pathLength={1}
              data-step="0"
              d="M37 20.5 L38.5 72 C62 205 300 207 323 71 L322 21"
            />
            <path pathLength={1} data-step="0" d="M166 34 L195 33.5" />
            <circle pathLength={1} data-step="0" cx="180.5" cy="44" r="6.5" />
          </g>

          {/* Offense: O1 up top, O2 right wing, O3 left wing, O4 high post, O5 low block */}
          <g className="play-diagram__offense">
            <circle pathLength={1} data-step="1" cx="181" cy="246" r="12" />
            <circle pathLength={1} data-step="1" cx="300" cy="166" r="12" />
            <circle pathLength={1} data-step="1" cx="58" cy="158" r="12" />
            <circle pathLength={1} data-step="1" cx="241" cy="132" r="12" />
            <circle pathLength={1} data-step="1" cx="118" cy="78" r="12" />
          </g>
          <g className="play-diagram__numbers">
            <text x="181" y="251.5">
              1
            </text>
            <text x="300" y="171.5">
              2
            </text>
            <text x="58" y="163.5">
              3
            </text>
            <text x="241" y="137.5">
              4
            </text>
            <text x="118" y="83.5">
              5
            </text>
          </g>

          {/* Defense: X3 cheats high toward the ball, which opens the backdoor */}
          <g className="play-diagram__defense">
            <path pathLength={1} data-step="2" d="M174 216 L186 227 M186.5 215.5 L173.5 227.5" />
            <path pathLength={1} data-step="2" d="M276 155 L287 166 M287 154 L275.5 166.5" />
            <path pathLength={1} data-step="2" d="M74 127 L86 138.5 M86.5 126.5 L73.5 139" />
            <path pathLength={1} data-step="2" d="M218 118 L229 129 M229.5 117 L217.5 129.5" />
            <path pathLength={1} data-step="2" d="M126 98 L137.5 109 M138 97.5 L125.5 109.5" />
          </g>

          {/* The play: 1 passes to 2, 4 sets a screen, 3 cuts backdoor, 2 hits him at the rim */}
          <g className="play-diagram__action">
            <path
              pathLength={1}
              data-step="3"
              className="play-diagram__dash"
              d="M193 238 C225 214 258 192 287 174"
            />
            <path pathLength={1} data-step="3" data-head="" d="M278 174.5 L287 174 L283.2 182.2" />
            <path pathLength={1} data-step="4" d="M231 140 C196 151 140 154 98 139.5" />
            <path pathLength={1} data-step="4" d="M93.5 130 L101.5 149" />
          </g>
          <g className="play-diagram__cut">
            <path
              pathLength={1}
              data-step="5"
              d="M54 171 C46 196 70 208 98 192 C128 174 151 118 168 64"
            />
            <path pathLength={1} data-step="5" data-head="" d="M161.5 70.2 L168 64 L170.4 72.7" />
            <path
              pathLength={1}
              data-step="6"
              className="play-diagram__dash"
              d="M288 160 C262 124 222 86 178 60"
            />
            <path pathLength={1} data-step="6" data-head="" d="M182.6 67.7 L178 60 L187 59.6" />
          </g>

          {/* Coach's pointer from the note to X3 */}
          <path
            pathLength={1}
            data-step="7"
            className="play-diagram__pointer"
            d="M24 262 C18 230 34 190 66 146"
          />
          <path
            pathLength={1}
            data-step="7"
            data-head=""
            className="play-diagram__pointer"
            d="M57.9 149.8 L66 146 L65.6 155"
          />
        </g>
      </svg>
      <figcaption className="play-diagram__note note">{note}</figcaption>
    </figure>
  );
}

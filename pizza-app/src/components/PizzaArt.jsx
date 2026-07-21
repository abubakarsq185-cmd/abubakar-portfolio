/* Hand-crafted SVG pizza. Swap for a real photo by passing `src`. */
export function PizzaArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 400" role="img" aria-label="Freshly baked signature pizza">
      <defs>
        <radialGradient id="crust" cx="50%" cy="42%" r="60%">
          <stop offset="60%" stopColor="#e6a94e" /><stop offset="80%" stopColor="#c9832f" /><stop offset="100%" stopColor="#8a4f18" />
        </radialGradient>
        <radialGradient id="crustEdge" cx="50%" cy="50%" r="50%">
          <stop offset="82%" stopColor="#d99640" /><stop offset="92%" stopColor="#b06d24" /><stop offset="100%" stopColor="#6e3d12" />
        </radialGradient>
        <radialGradient id="cheese" cx="46%" cy="40%" r="58%">
          <stop offset="0%" stopColor="#ffe08a" /><stop offset="55%" stopColor="#f6c85a" /><stop offset="100%" stopColor="#e0a637" />
        </radialGradient>
        <radialGradient id="sauce" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c3341f" /><stop offset="100%" stopColor="#8f1d12" />
        </radialGradient>
        <radialGradient id="pep" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#d94f3a" /><stop offset="60%" stopColor="#b02a1c" /><stop offset="100%" stopColor="#7c160d" />
        </radialGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="1.1" /></filter>
      </defs>
      <circle cx="200" cy="200" r="188" fill="url(#crustEdge)" />
      <circle cx="200" cy="200" r="176" fill="url(#crust)" />
      <g opacity=".5" fill="#7c4715">
        <ellipse cx="200" cy="26" rx="15" ry="8" /><ellipse cx="330" cy="90" rx="12" ry="9" transform="rotate(40 330 90)" />
        <ellipse cx="372" cy="220" rx="8" ry="13" /><ellipse cx="300" cy="345" rx="13" ry="8" transform="rotate(-30 300 345)" />
        <ellipse cx="90" cy="330" rx="12" ry="8" transform="rotate(30 90 330)" /><ellipse cx="26" cy="180" rx="8" ry="13" />
        <ellipse cx="80" cy="70" rx="12" ry="8" transform="rotate(-40 80 70)" />
      </g>
      <circle cx="200" cy="200" r="150" fill="url(#sauce)" />
      <circle cx="200" cy="200" r="150" fill="url(#cheese)" opacity=".92" />
      <g fill="#fff2c2" opacity=".45" filter="url(#soft)">
        <ellipse cx="150" cy="140" rx="26" ry="16" transform="rotate(-20 150 140)" />
        <ellipse cx="255" cy="175" rx="30" ry="18" transform="rotate(15 255 175)" />
        <ellipse cx="175" cy="255" rx="28" ry="16" transform="rotate(25 175 255)" />
        <ellipse cx="255" cy="260" rx="20" ry="13" />
      </g>
      <g>
        <g><circle cx="140" cy="130" r="24" fill="url(#pep)" /><circle cx="132" cy="122" r="6" fill="#8f1d12" opacity=".6" /></g>
        <g><circle cx="258" cy="128" r="23" fill="url(#pep)" /><circle cx="266" cy="136" r="5" fill="#8f1d12" opacity=".6" /></g>
        <g><circle cx="285" cy="215" r="24" fill="url(#pep)" /><circle cx="278" cy="208" r="6" fill="#8f1d12" opacity=".6" /></g>
        <g><circle cx="150" cy="270" r="23" fill="url(#pep)" /><circle cx="158" cy="278" r="5" fill="#8f1d12" opacity=".6" /></g>
        <g><circle cx="230" cy="285" r="22" fill="url(#pep)" /><circle cx="222" cy="278" r="5" fill="#8f1d12" opacity=".5" /></g>
        <g><circle cx="112" cy="200" r="20" fill="url(#pep)" /><circle cx="118" cy="206" r="4" fill="#8f1d12" opacity=".5" /></g>
        <g><circle cx="205" cy="205" r="21" fill="url(#pep)" /><circle cx="200" cy="200" r="5" fill="#8f1d12" opacity=".5" /></g>
      </g>
      <g fill="#2a1522"><circle cx="185" cy="150" r="9" /><circle cx="245" cy="185" r="8" /><circle cx="170" cy="215" r="8" /><circle cx="255" cy="250" r="9" /><circle cx="130" cy="250" r="7" /></g>
      <g fill="#5a3348"><circle cx="185" cy="150" r="4" /><circle cx="245" cy="185" r="3.5" /><circle cx="170" cy="215" r="3.5" /><circle cx="255" cy="250" r="4" /><circle cx="130" cy="250" r="3" /></g>
      <g fill="#3f8f37" opacity=".95">
        <path d="M110 160 q18 -8 30 4 q-14 10 -30 -4z" /><path d="M300 160 q-18 -8 -30 4 q14 10 30 -4z" />
        <path d="M200 300 q10 -16 24 -10 q-6 18 -24 10z" /><path d="M120 300 q-10 -14 4 -22 q14 12 -4 22z" />
        <path d="M290 300 q10 -14 -4 -22 q-14 12 4 22z" />
      </g>
      <g fill="#5cb050" opacity=".9"><ellipse cx="215" cy="235" rx="12" ry="6" transform="rotate(30 215 235)" /><ellipse cx="160" cy="185" rx="11" ry="5" transform="rotate(-25 160 185)" /></g>
      <ellipse cx="160" cy="130" rx="90" ry="60" fill="#fff" opacity=".07" filter="url(#soft)" />
    </svg>
  )
}

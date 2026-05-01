// SVG overlay: dark mask with branded oval cutout + animated pulse ring
export default function FaceOverlay() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 640 480"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Cutout mask — white = visible, black = masked */}
        <mask id="face-mask">
          <rect width="640" height="480" fill="white" />
          <ellipse cx="320" cy="228" rx="152" ry="192" fill="black" />
        </mask>
      </defs>

      {/* Dark overlay with oval hole */}
      <rect
        width="640"
        height="480"
        fill="rgba(0, 0, 0, 0.50)"
        mask="url(#face-mask)"
      />

      {/* Solid oval border — primary blue */}
      <ellipse
        cx="320"
        cy="228"
        rx="152"
        ry="192"
        fill="none"
        stroke="#017DC5"
        strokeWidth="3"
        strokeDasharray="14 7"
        opacity="0.9"
      />

      {/* Animated accent pulse — orange */}
      <ellipse
        cx="320"
        cy="228"
        rx="164"
        ry="204"
        fill="none"
        stroke="#FBA519"
        strokeWidth="2.5"
      >
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="rx" values="164;172;164" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="ry" values="204;212;204" dur="2.4s" repeatCount="indefinite" />
      </ellipse>

      {/* Corner tick marks for alignment guides */}
      {[
        { x: 178, y: 100, r: -45 },
        { x: 462, y: 100, r: 45 },
        { x: 178, y: 356, r: -135 },
        { x: 462, y: 356, r: 135 },
      ].map(({ x, y, r }, i) => (
        <g key={i} transform={`translate(${x},${y}) rotate(${r})`}>
          <line x1="0" y1="0" x2="16" y2="0" stroke="#FBA519" strokeWidth="3" strokeLinecap="round" />
          <line x1="0" y1="0" x2="0" y2="16" stroke="#FBA519" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}

      {/* Instruction label */}
      <text
        x="320"
        y="452"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        opacity="0.9"
      >
        Align your face here
      </text>
    </svg>
  );
}

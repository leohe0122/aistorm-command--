import { cn } from "@/lib/utils";

interface AIStormLogoProps {
  className?: string;
  /** Height in pixels, width scales proportionally */
  height?: number;
  /** Show text next to icon */
  showText?: boolean;
}

/**
 * AIStorm Logo SVG component.
 * Renders the circular ring icon + "AIStorm" text in white.
 * Transparent background — works on any dark surface.
 */
export default function AIStormLogo({ className, height = 32, showText = true }: AIStormLogoProps) {
  // Icon aspect ratio ~1:1, text adds ~2.5x width
  const iconSize = height;
  const textWidth = showText ? iconSize * 2.4 : 0;
  const totalWidth = iconSize + (showText ? iconSize * 0.3 + textWidth : 0);

  return (
    <svg
      width={totalWidth}
      height={iconSize}
      viewBox={`0 0 ${totalWidth} ${iconSize}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
    >
      <defs>
        {/* Blue-teal gradient for top arc */}
        <linearGradient id="grad-blue-teal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B6FBF" />
          <stop offset="50%" stopColor="#00A8D6" />
          <stop offset="100%" stopColor="#4DB87A" />
        </linearGradient>
        {/* Silver gradient for bottom arc */}
        <linearGradient id="grad-silver" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8a9ab0" />
          <stop offset="50%" stopColor="#c8d4e0" />
          <stop offset="100%" stopColor="#6a7a8a" />
        </linearGradient>
        {/* Green gradient for right arc */}
        <linearGradient id="grad-green" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4DB87A" />
          <stop offset="100%" stopColor="#2a9d5c" />
        </linearGradient>
      </defs>

      {/* ── Icon: Möbius-ring style circular logo ── */}
      {/* Outer ring circle (clipped to show only the ring band) */}
      <g transform={`translate(${iconSize * 0.5}, ${iconSize * 0.5})`}>
        {/* Ring band — drawn as thick stroked arc paths */}
        {/* Top-left blue arc */}
        <path
          d={`M ${-iconSize*0.28} ${-iconSize*0.1}
              A ${iconSize*0.38} ${iconSize*0.38} 0 0 1 ${iconSize*0.05} ${-iconSize*0.42}`}
          stroke="url(#grad-blue-teal)"
          strokeWidth={iconSize * 0.16}
          strokeLinecap="round"
          fill="none"
        />
        {/* Top-right teal-green arc */}
        <path
          d={`M ${iconSize*0.05} ${-iconSize*0.42}
              A ${iconSize*0.38} ${iconSize*0.38} 0 0 1 ${iconSize*0.32} ${iconSize*0.08}`}
          stroke="url(#grad-blue-teal)"
          strokeWidth={iconSize * 0.14}
          strokeLinecap="round"
          fill="none"
        />
        {/* Right-bottom green arc */}
        <path
          d={`M ${iconSize*0.32} ${iconSize*0.08}
              A ${iconSize*0.38} ${iconSize*0.38} 0 0 1 ${iconSize*0.05} ${iconSize*0.38}`}
          stroke="url(#grad-green)"
          strokeWidth={iconSize * 0.14}
          strokeLinecap="round"
          fill="none"
        />
        {/* Bottom silver arc */}
        <path
          d={`M ${iconSize*0.05} ${iconSize*0.38}
              A ${iconSize*0.38} ${iconSize*0.38} 0 0 1 ${-iconSize*0.28} ${iconSize*0.1}`}
          stroke="url(#grad-silver)"
          strokeWidth={iconSize * 0.16}
          strokeLinecap="round"
          fill="none"
        />
        {/* Bottom-left blue arc (closes the ring) */}
        <path
          d={`M ${-iconSize*0.28} ${iconSize*0.1}
              A ${iconSize*0.38} ${iconSize*0.38} 0 0 1 ${-iconSize*0.28} ${-iconSize*0.1}`}
          stroke="#1B6FBF"
          strokeWidth={iconSize * 0.16}
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* ── Text: AIStorm in white ── */}
      {showText && (
        <text
          x={iconSize + iconSize * 0.3}
          y={iconSize * 0.72}
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontWeight="700"
          fontSize={iconSize * 0.62}
          fill="white"
          letterSpacing="-0.02em"
        >
          AIStorm
        </text>
      )}
    </svg>
  );
}

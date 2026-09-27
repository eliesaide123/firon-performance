/**
 * The prototype's inline SVG icons, redrawn with react-native-svg.
 * The `d` attributes are copied verbatim from docs/prototype.html — no icon font.
 */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { FP_COLORS } from '../theme';

export type FP_IconName =
  | 'home'
  | 'dumbbell'
  | 'video'
  | 'user'
  | 'users'
  | 'plans'
  | 'upload'
  | 'search'
  | 'play'
  | 'trash'
  | 'bell'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'logo'
  | 'clipboard'
  | 'meal'
  | 'camera'
  | 'warning';

export interface FP_IconProps {
  name: FP_IconName;
  size?: number;
  color?: string;
  /** the prototype's tab icons use stroke-width 1.9 */
  strokeWidth?: number;
}

export const FP_Icon: React.FC<FP_IconProps> = ({
  name,
  size = 24,
  color = FP_COLORS.muted,
  strokeWidth = 1.9,
}) => {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {renderPaths(name, color, stroke)}
    </Svg>
  );
};

type StrokeProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
};

function renderPaths(name: FP_IconName, color: string, s: StrokeProps): React.ReactNode {
  switch (name) {
    case 'home':
      return (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...s} />
          <Path d="M5 9.5V21h14V9.5" {...s} />
        </>
      );
    case 'dumbbell':
      return (
        <>
          <Path d="M4 8v8M8 6v12M16 6v12M20 8v8" {...s} />
          <Path d="M8 12h8" {...s} />
        </>
      );
    case 'video':
      return (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={3} stroke={color} strokeWidth={s.strokeWidth} />
          <Path d="M10 9l5 3-5 3z" {...s} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={s.strokeWidth} />
          <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" {...s} />
        </>
      );
    case 'users':
      return (
        <>
          <Circle cx={9} cy={8} r={3} stroke={color} strokeWidth={s.strokeWidth} />
          <Path d="M3 20c0-3 3-5 6-5s6 2 6 5" {...s} />
          <Circle cx={17.5} cy={9} r={2.5} stroke={color} strokeWidth={s.strokeWidth} />
          <Path d="M15 20c0-2.5 2-3.5 4-3.5" {...s} />
        </>
      );
    case 'plans':
      return (
        <>
          <Path d="M4 6h16M4 12h16M4 18h10" {...s} />
          <Circle cx={19} cy={18} r={2.2} stroke={color} strokeWidth={s.strokeWidth} />
        </>
      );
    case 'upload':
      return (
        <>
          <Path d="M12 16V4M7 9l5-5 5 5" {...s} />
          <Path d="M4 20h16" {...s} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={s.strokeWidth} />
          <Path d="m20 20-3.2-3.2" {...s} />
        </>
      );
    case 'play':
      // the prototype's solid triangle: fill:currentColor, stroke:none
      return <Path d="M8 5v14l11-7z" fill={color} />;
    case 'trash':
      return <Path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" {...s} />;
    case 'bell':
      return (
        <>
          <Path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 15z" {...s} />
          <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" {...s} />
        </>
      );
    case 'chevron-left':
      return <Path d="M15 18l-6-6 6-6" {...s} />;
    case 'chevron-right':
      return <Path d="M9 6l6 6-6 6" {...s} />;
    case 'check':
      return <Path d="M5 12.5l4.5 4.5L19 7" {...s} strokeWidth={Math.max(s.strokeWidth, 3)} />;
    case 'logo':
      // the ◈ mark the login header uses
      return (
        <>
          <Path d="M12 3l6 9-6 9-6-9 6-9z" {...s} />
          <Path d="M12 8.5l3 3.5-3 3.5-3-3.5 3-3.5z" fill={color} />
        </>
      );
    case 'clipboard':
      return (
        <>
          <Rect x={5} y={4} width={14} height={17} rx={2.5} stroke={color} strokeWidth={s.strokeWidth} />
          <Path d="M9 4.5V3.5h6v1M9 10h6M9 14h6M9 18h3" {...s} />
        </>
      );
    case 'meal':
      return (
        <>
          <Path d="M5 3v8a2.5 2.5 0 0 0 5 0V3M7.5 11v10" {...s} />
          <Path d="M16 3c2 0 3.5 2 3.5 5s-1.5 4-1.5 4v9" {...s} />
        </>
      );
    case 'camera':
      return (
        <>
          <Rect x={3} y={7} width={13} height={11} rx={2.5} stroke={color} strokeWidth={s.strokeWidth} />
          <Path d="M16 11l5-2.5v11L16 17z" {...s} />
        </>
      );
    case 'warning':
      return (
        <>
          <Path d="M12 4l9 16H3l9-16z" {...s} />
          <Path d="M12 10v4.5M12 17.4v.2" {...s} />
        </>
      );
    default:
      return null;
  }
}

export default FP_Icon;

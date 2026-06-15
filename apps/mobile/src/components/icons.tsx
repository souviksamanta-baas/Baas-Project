import type { ReactElement } from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '../theme';

export type IconKind =
  | 'alert'
  | 'arrow-left'
  | 'bell'
  | 'bill'
  | 'bot'
  | 'box'
  | 'cart'
  | 'cash'
  | 'chevron-down'
  | 'chevron-up'
  | 'email'
  | 'facebook'
  | 'filter'
  | 'gear'
  | 'globe'
  | 'help'
  | 'home'
  | 'inbox'
  | 'instagram'
  | 'logout'
  | 'megaphone'
  | 'message'
  | 'mic'
  | 'money'
  | 'more'
  | 'plus'
  | 'puzzle'
  | 'report'
  | 'store'
  | 'user'
  | 'users'
  | 'whatsapp';

export function Icon(props: {
  color?: string;
  filled?: boolean;
  kind: IconKind;
  size?: number;
  strokeWidth?: number;
}): ReactElement {
  const size = props.size ?? 18;
  const color = props.color ?? colors.navy;
  const strokeWidth = props.strokeWidth ?? 1.8;

  return (
    <Svg fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24" width={size}>
      {iconPath(props.kind, color, props.filled)}
    </Svg>
  );
}

export function ChannelIcon(props: { channel: 'email' | 'facebook' | 'instagram' | 'whatsapp'; size?: number }): ReactElement {
  const color =
    props.channel === 'whatsapp'
      ? '#20c76a'
      : props.channel === 'instagram'
        ? '#d94a8c'
        : props.channel === 'facebook'
          ? '#1877f2'
          : '#6b4fc3';

  return (
    <Svg fill="none" height={props.size ?? 13} viewBox="0 0 24 24" width={props.size ?? 13}>
      {props.channel === 'whatsapp' ? (
        <>
          <Path d="M5.2 19.2 6.3 15.6a7.3 7.3 0 1 1 2.8 2.7l-3.9.9Z" fill="#ffffff" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M9.5 8.6c.2-.5.4-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.3.1.5-.1.7l-.5.6c.8 1.3 1.8 2.2 3.2 2.8l.6-.7c.2-.2.4-.3.7-.2l1.6.7c.3.1.4.3.4.6v.4c0 .5-.2.8-.6 1-1 .5-3.1-.1-5.2-1.9-2.3-2-3.3-4.4-2.6-5.5Z" fill={color} />
        </>
      ) : props.channel === 'instagram' ? (
        <>
          <Rect height={15} rx={4} stroke={color} strokeWidth={2.1} width={15} x={4.5} y={4.5} />
          <Circle cx={12} cy={12} r={3.1} stroke={color} strokeWidth={2.1} />
          <Circle cx={16.5} cy={7.6} fill={color} r={1} />
        </>
      ) : props.channel === 'facebook' ? (
        <Path d="M14.4 8.5h2V5.2h-2.7c-3 0-4.4 1.8-4.4 4.6v2H6.6v3.7h2.7V22h3.9v-6.5h3l.6-3.7h-3.6V10c0-1 .4-1.5 1.2-1.5Z" fill={color} />
      ) : (
        <>
          <Rect height={13} rx={2.5} stroke={color} strokeWidth={2.1} width={17} x={3.5} y={5.5} />
          <Path d="m5 8 7 5 7-5" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} />
        </>
      )}
    </Svg>
  );
}

export function IphoneStatusIcons(props: { color?: string }): ReactElement {
  const color = props.color ?? '#000000';

  return (
    <Svg fill="none" height={12} viewBox="0 0 70 14" width={70}>
      <Rect fill={color} height={3} rx={1} width={3} x={0} y={9} />
      <Rect fill={color} height={5} rx={1} width={3} x={5} y={7} />
      <Rect fill={color} height={7} rx={1} width={3} x={10} y={5} />
      <Rect fill={color} height={9} rx={1} width={3} x={15} y={3} />
      <Path d="M28 5.1c4-3.1 10.6-3.1 14.6 0" stroke={color} strokeLinecap="round" strokeWidth={1.7} />
      <Path d="M31.2 8c2.4-1.7 5.8-1.7 8.2 0" stroke={color} strokeLinecap="round" strokeWidth={1.7} />
      <Path d="M34.3 10.6c.6-.5 1.3-.5 1.9 0" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
      <Rect height={9} rx={2} stroke={color} strokeWidth={1.3} width={18} x={49} y={2} />
      <Path d="M68.5 5.2v2.6" stroke={color} strokeLinecap="round" strokeWidth={1.3} />
      <Rect fill={color} height={5} rx={1} width={12} x={52} y={4} />
    </Svg>
  );
}

export function CopiRobotIcon(props: { size?: number }): ReactElement {
  const size = props.size ?? 76;

  return (
    <Svg height={size} style={robotDropShadowStyle} viewBox="0 0 96 96" width={size}>
      <Circle cx={48} cy={9} fill="#12d47a" opacity={0.5} r={8} />
      <Rect fill="#12d47a" height={8} rx={1} width={2} x={47} y={11} />
      <Circle cx={48} cy={9} fill="#12d47a" r={5} />
      <G>
        <Rect fill="#e7edf2" height={33} rx={18} width={47} x={24} y={60} />
        <Rect fill="#eef3f7" height={24} rx={6.5} transform="rotate(-18 22.5 74)" width={13} x={16} y={62} />
        <Rect fill="#eef3f7" height={24} rx={6.5} transform="rotate(18 73.5 74)" width={13} x={67} y={62} />
        <Rect fill="#f4f7fa" height={8} rx={3} width={4} x={13} y={42} />
        <Rect fill="#f4f7fa" height={8} rx={3} width={4} x={79} y={42} />
        <Rect fill="#f5f8fa" height={53} rx={28} width={64} x={16} y={18} />
        <Rect fill={colors.navy} height={28} rx={15} width={44} x={26} y={30} />
        <Circle cx={39} cy={44} fill="#54ffd0" opacity={0.34} r={7} />
        <Circle cx={57} cy={44} fill="#54ffd0" opacity={0.34} r={7} />
        <Circle cx={39} cy={44} fill="#54ffd0" r={4} />
        <Circle cx={57} cy={44} fill="#54ffd0" r={4} />
        <Path d="M41.5 52.5c3.5 3 9.5 3 13 0" fill="none" stroke="#54ffd0" strokeLinecap="round" strokeWidth={2} />
        <Rect fill="#12d47a" height={15} rx={7} width={20} x={38} y={63} />
        <SvgText fill="#ffffff" fontSize={8} fontWeight="700" textAnchor="middle" x={48} y={74}>∞</SvgText>
      </G>
    </Svg>
  );
}

const robotDropShadowStyle =
  Platform.OS === 'web'
    ? ({ filter: 'drop-shadow(0px 12px 16px rgba(16, 25, 53, 0.26))' } as never)
    : undefined;

function iconPath(kind: IconKind, color: string, filled?: boolean): ReactElement {
  if (kind === 'bell') {
    return (
      <>
        <Path d="M17.5 10.5c0-3.4-2.2-5.8-5.5-5.8s-5.5 2.4-5.5 5.8c0 3.9-1.9 4.9-2.8 6.1h16.6c-.9-1.2-2.8-2.2-2.8-6.1Z" />
        <Path d="M9.8 20.1c.5.5 1.2.8 2.2.8s1.7-.3 2.2-.8" />
        <Path d="M12 3.2V2.1" />
      </>
    );
  }

  if (kind === 'store') {
    return (
      <>
        <Path d="M5 9.2h14l-1.2-4.7H6.2L5 9.2Z" />
        <Path d="M6.5 9.2v10.1h11V9.2" />
        <Path d="M9.3 19.3v-5h5.4v5" />
      </>
    );
  }

  if (kind === 'chevron-down') return <Path d="m7 9 5 5 5-5" />;
  if (kind === 'chevron-up') return <Path d="m7 15 5-5 5 5" />;
  if (kind === 'arrow-left') return <><Path d="M19 12H5" /><Path d="m12 5-7 7 7 7" /></>;
  if (kind === 'filter') return <><Path d="M4 6.5h16" /><Path d="M7 12h10" /><Path d="M10 17.5h4" /></>;
  if (kind === 'plus') return <><Path d="M12 5v14" /><Path d="M5 12h14" /></>;
  if (kind === 'mic') return <><Rect height="10" rx="3" width="6" x="9" y="3" /><Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><Path d="M12 18v3" /></>;
  if (kind === 'home') return <><Path d="m4.5 10.5 7.5-6 7.5 6" /><Path d="M6.2 9.5v10h11.6v-10" /><Path d="M10 19.5v-5h4v5" /></>;
  if (kind === 'inbox') return <><Path d="M4.5 5.5h15v13h-15z" /><Path d="M4.5 13h4l1.5 2h4l1.5-2h4" /></>;
  if (kind === 'more') return <><Circle cx="6" cy="12" r="1.2" fill={color} stroke="none" /><Circle cx="12" cy="12" r="1.2" fill={color} stroke="none" /><Circle cx="18" cy="12" r="1.2" fill={color} stroke="none" /></>;
  if (kind === 'money') return <><Circle cx="12" cy="12" r="8.5" fill={filled ? color : 'none'} /><Path d="M12 7.5v9" stroke={filled ? '#fff' : color} /><Path d="M14.4 9.3c-.5-.6-1.3-.9-2.4-.9-1.4 0-2.3.7-2.3 1.8 0 2.6 4.8 1.2 4.8 4 0 1.1-1 1.8-2.5 1.8-1.1 0-2-.3-2.6-1" stroke={filled ? '#fff' : color} /></>;
  if (kind === 'message') return <><Path d="M5 6.5h14v9H9l-4 3v-12Z" /><Path d="M8.5 10h7" /><Path d="M8.5 13h4.5" /></>;
  if (kind === 'box') return <><Path d="m12 4 7 4-7 4-7-4 7-4Z" /><Path d="M5 8v8l7 4 7-4V8" /><Path d="M12 12v8" /></>;
  if (kind === 'bill') return <><Path d="M7 4h10v16l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V4Z" /><Path d="M9.5 9h5" /><Path d="M9.5 13h4" /></>;
  if (kind === 'cart') return <><Path d="M4 5h2l2 10h9l2-7H7" /><Circle cx="10" cy="20" r="1" /><Circle cx="17" cy="20" r="1" /></>;
  if (kind === 'cash') return <><Rect height="9" rx="2" width="16" x="4" y="8" /><Path d="M7 8V5h10v3" /><Path d="M8 13h3" /></>;
  if (kind === 'megaphone') return <><Path d="M4 13V9l11-4v12L4 13Z" /><Path d="M8 14v4" /><Path d="M18 9.5v3" /></>;
  if (kind === 'puzzle') return <Path d="M8 3h8v5h3v8h-5v3H6v-8h2V8H5V5h3V3Z" />;
  if (kind === 'user') return <><Circle cx="12" cy="8" r="3.2" /><Path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5" /></>;
  if (kind === 'users') return <><Path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><Path d="M3 20c.6-3.5 2.3-5.2 5-5.2s4.4 1.7 5 5.2" /><Path d="M16 11a2.5 2.5 0 1 0 0-5" /><Path d="M14.5 15c2 .2 3.3 1.8 3.8 5" /></>;
  if (kind === 'gear') return <><Path d="M9.6 3.2 9 5.6a7.5 7.5 0 0 0-1.6.9L5 5.8 3.2 8.9l1.8 1.7a7.9 7.9 0 0 0 0 1.8l-1.8 1.7L5 17.2l2.4-.7a7.5 7.5 0 0 0 1.6.9l.6 2.4h4.8l.6-2.4a7.5 7.5 0 0 0 1.6-.9l2.4.7 1.8-3.1-1.8-1.7a7.9 7.9 0 0 0 0-1.8l1.8-1.7L19 5.8l-2.4.7a7.5 7.5 0 0 0-1.6-.9l-.6-2.4H9.6Z" /><Circle cx="12" cy="12" r="3" /></>;
  if (kind === 'globe') return <><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18" /><Path d="M12 3c2.2 2.5 3.2 5.5 3.2 9S14.2 18.5 12 21" /><Path d="M12 3c-2.2 2.5-3.2 5.5-3.2 9s1 6.5 3.2 9" /></>;
  if (kind === 'report') return <><Rect height="15" rx="2" width="14" x="5" y="4" /><Path d="M9 15V9" /><Path d="M12 15v-4" /><Path d="M15 15V7" /></>;
  if (kind === 'help') return <><Circle cx="12" cy="12" r="9" /><Path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.2c-1 .7-1.4 1.2-1.4 2.3" /><Path d="M12 17h.01" /></>;
  if (kind === 'logout') return <><Path d="M10 5H5v14h5" /><Path d="M14 8l4 4-4 4" /><Path d="M18 12H9" /></>;
  if (kind === 'bot') return <><Rect height="12" rx="4" width="16" x="4" y="7" /><Path d="M12 7V4" /><Path d="M8.5 12h.01" /><Path d="M15.5 12h.01" /><Path d="M9.5 15c1.4.9 3.6.9 5 0" /></>;
  if (kind === 'alert') return <><Path d="M12 8v5" /><Path d="M12 17h.01" /><Path d="M10.4 4.2 3.2 17a2 2 0 0 0 1.8 3h14a2 2 0 0 0 1.8-3L13.6 4.2a1.8 1.8 0 0 0-3.2 0Z" /></>;
  if (kind === 'whatsapp' || kind === 'instagram' || kind === 'facebook' || kind === 'email') {
    return <ChannelIcon channel={kind} size={24} />;
  }

  return <Path d="M5 6.5h14v9H9l-4 3v-12Z" />;
}

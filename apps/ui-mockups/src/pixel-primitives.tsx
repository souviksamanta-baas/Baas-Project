import { type ReactElement, type ReactNode } from 'react';

export interface InicioStyleControls {
  cardRadius: number;
  copiTextSize: number;
  greetingSize: number;
  headerIconStroke: number;
  headerIconSize: number;
  logoSize: number;
  metricIconSize: number;
  metricNumberSize: number;
  sectionTitleSize: number;
  subtitleSize: number;
  taglineSize: number;
  verticalSpacing: number;
}

function SvgIcon(props: {
  children: ReactNode;
  className?: string;
  size?: string;
  strokeWidth?: number | string;
}): ReactElement {
  return (
    <svg
      className={props.className}
      fill="none"
      height={props.size ?? '24'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? '2'}
      viewBox="0 0 24 24"
      width={props.size ?? '24'}
    >
      {props.children}
    </svg>
  );
}

export function BellIcon(props: { size?: string; strokeWidth?: number | string }): ReactElement {
  return (
    <SvgIcon className={props.size ? undefined : 'h-[18px] w-[18px]'} size={props.size} strokeWidth={props.strokeWidth ?? 1.3}>
      <path d="M17.5 10.5c0-3.4-2.2-5.8-5.5-5.8s-5.5 2.4-5.5 5.8c0 3.9-1.9 4.9-2.8 6.1h16.6c-.9-1.2-2.8-2.2-2.8-6.1Z" />
      <path d="M9.8 20.1c.5.5 1.2.8 2.2.8s1.7-.3 2.2-.8" />
      <path d="M12 3.2V2.1" />
    </SvgIcon>
  );
}

export function StoreIcon(props: { size?: string; strokeWidth?: number | string }): ReactElement {
  return (
    <SvgIcon className={props.size ? undefined : 'h-[22px] w-[22px]'} size={props.size} strokeWidth={props.strokeWidth ?? 1.3}>
      <path d="M5 9.2h14l-1.2-4.7H6.2L5 9.2Z" />
      <path d="M6.5 9.2v10.1h11V9.2" />
      <path d="M9.3 19.3v-5h5.4v5" />
      <path d="M4.9 9.2c.2 1.4 1.2 2.2 2.5 2.2 1.1 0 2-.6 2.4-1.6.4 1 1.3 1.6 2.3 1.6s1.9-.6 2.3-1.6c.4 1 1.3 1.6 2.4 1.6 1.3 0 2.3-.8 2.5-2.2" />
    </SvgIcon>
  );
}

export function ChevronDownIcon(props: { open?: boolean; size?: string; strokeWidth?: number | string }): ReactElement {
  return <SvgIcon size={props.size ?? '12'} strokeWidth={props.strokeWidth ?? 2}><path d={props.open ? 'm7 15 5-5 5 5' : 'm7 9 5 5 5-5'} /></SvgIcon>;
}

export function SearchIcon(): ReactElement {
  return <SvgIcon className="h-[14px] w-[14px]" strokeWidth={1.8}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></SvgIcon>;
}

export function PlusIcon(): ReactElement {
  return <SvgIcon className="h-[17px] w-[17px]" strokeWidth={2}><path d="M12 5v14" /><path d="M5 12h14" /></SvgIcon>;
}

export function ArrowLeftIcon(): ReactElement {
  return <SvgIcon className="h-[20px] w-[20px]" strokeWidth={2.2}><path d="M19 12H5" /><path d="m12 5-7 7 7 7" /></SvgIcon>;
}

export function EditIcon(props: { className?: string } = {}): ReactElement {
  return <SvgIcon className={props.className ?? 'h-[13px] w-[13px]'} strokeWidth={2}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14 8 2 2" /></SvgIcon>;
}

export function CameraIcon(): ReactElement {
  return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><path d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="12.6" r="3" /></SvgIcon>;
}

export function FilterIcon(): ReactElement {
  return (
    <SvgIcon className="h-[17px] w-[17px]" strokeWidth={1.7}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
      <circle cx="8" cy="6.5" r="1.8" />
      <circle cx="15.8" cy="12" r="1.8" />
      <circle cx="10.5" cy="17.5" r="1.8" />
    </SvgIcon>
  );
}

export function ChevronRightIcon(): ReactElement {
  return <SvgIcon className="h-[14px] w-[14px]" strokeWidth={2.2}><path d="m9 6 6 6-6 6" /></SvgIcon>;
}

export function BoxIcon(props: { size?: string } = {}): ReactElement {
  return (
    <SvgIcon className={props.size ? undefined : 'h-[17px] w-[17px]'} size={props.size} strokeWidth={1.9}>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
      <path d="M12 12v8" />
      <path d="m20 8.5-8 4.5-8-4.5" />
    </SvgIcon>
  );
}

export function CheckIcon(): ReactElement {
  return <SvgIcon className="h-[14px] w-[14px]" strokeWidth={2.2}><path d="m5 12 3 3 7-7" /><path d="m12 14 4 4 6-7" /></SvgIcon>;
}

export function HomeIcon(props: { active?: boolean; className?: string } = {}): ReactElement {
  return (
    <svg aria-hidden="true" className={props.className ?? 'h-[22px] w-[22px]'} fill="none" viewBox="0 0 24 24">
      <path
        d="M5.5 10.8 12 5.5l6.5 5.3V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19v-8.2Z"
        fill={props.active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path d="M10 20.5V14h4v6.5" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function InboxIcon(props: { active?: boolean; className?: string } = {}): ReactElement {
  return (
    <svg aria-hidden="true" className={props.className ?? 'h-[22px] w-[22px]'} fill="none" viewBox="0 0 24 24">
      <path
        d="M5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V9A1.5 1.5 0 0 1 5 7.5Z"
        fill={props.active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path d="M8.5 11.5h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

export function BotIcon(props: { active?: boolean; className?: string } = {}): ReactElement {
  return (
    <svg aria-hidden="true" className={props.className ?? 'h-[22px] w-[22px]'} fill="none" viewBox="0 0 24 24">
      <path d="M12 4.2v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <circle cx="12" cy="3.4" fill={props.active ? 'currentColor' : 'none'} r="1.1" stroke="currentColor" strokeWidth="1.6" />
      <rect height="11.1" rx="3.7" stroke="currentColor" strokeWidth="1.9" width="14.5" x="4.75" y="7.9" />
      <circle cx="9.2" cy="13.1" fill="currentColor" r="1.15" />
      <circle cx="14.8" cy="13.1" fill="currentColor" r="1.15" />
      <path d="M9.6 16.1c1.4.8 3.4.8 4.8 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

export function MenuIcon(props: { active?: boolean; className?: string } = {}): ReactElement {
  return (
    <svg aria-hidden="true" className={props.className ?? 'h-[22px] w-[22px]'} fill="none" viewBox="0 0 24 24">
      <path d="M5 7h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function PixelBottomNav(props: {
  active?: 'Inicio' | 'Inbox' | 'Copi' | 'Mas';
  mutedCenter?: boolean;
}): ReactElement {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[64px] rounded-t-[24px] border border-[#e1e8ec] bg-white shadow-[0_-8px_24px_rgba(16,25,53,0.08)]">
      <div className="grid h-full grid-cols-5 items-center px-[22px] text-center">
        <PixelNavItem active={props.active === 'Inicio'} icon={HomeIcon} label="Inicio" />
        <PixelNavItem active={props.active === 'Inbox'} icon={InboxIcon} label="Inbox" />
        <div className="relative flex justify-center">
          <div
            className={`absolute bottom-[-20px] flex h-[63px] w-[63px] items-center justify-center rounded-full border-[6px] border-white text-[30px] font-medium shadow-[0_8px_24px_rgba(10,158,86,0.18)] ${
              props.mutedCenter ? 'bg-white text-[#101935]' : 'bg-[#03bd62] text-white'
            }`}
          >
            $
          </div>
        </div>
        <PixelNavItem active={props.active === 'Copi'} icon={BotIcon} label="Copi" />
        <PixelNavItem active={props.active === 'Mas'} icon={MenuIcon} label="Más" />
      </div>
    </div>
  );
}

function PixelNavItem(props: {
  active?: boolean;
  icon: (iconProps: { active?: boolean }) => ReactElement;
  label: string;
}): ReactElement {
  const Icon = props.icon;

  return (
    <div className={`flex flex-col items-center gap-[3px] text-[10px] font-semibold ${props.active ? 'text-[#08bd66]' : 'text-[#53607a]'}`}>
      <Icon active={props.active} />
      <span>{props.label}</span>
    </div>
  );
}

export function InboxFilterButton(): ReactElement {
  return (
    <button
      className="flex h-[34px] w-[38px] shrink-0 items-center justify-center rounded-[9px] border border-[#dfe7ec] bg-white text-[#56627b]"
      type="button"
    >
      <FilterIcon />
    </button>
  );
}

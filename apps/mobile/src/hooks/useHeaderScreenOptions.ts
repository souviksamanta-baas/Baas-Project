import { useEffect } from 'react';

import { useHeaderChromeOptional } from '../context/HeaderChromeProvider';

/** Registers the current screen's app-header title and scroll-collapse behavior. */
export function useHeaderScreenOptions(options: {
  collapseOnScroll?: boolean;
  forceCollapsed?: boolean;
  onBack?: (() => void) | null;
  title?: string | null;
}): void {
  const { resetChrome, setChrome, setCollapsed } = useHeaderChromeOptional();
  const forceCollapsed = options.forceCollapsed === true;
  const collapseOnScroll = forceCollapsed ? true : (options.collapseOnScroll ?? true);
  const onBack = options.onBack ?? null;
  const title = options.title ?? null;

  useEffect(() => {
    setChrome({
      collapseEnabled: collapseOnScroll,
      onBack,
      title,
    });

    if (forceCollapsed) {
      setCollapsed(true);
    }

    return () => {
      resetChrome();
    };
  }, [collapseOnScroll, forceCollapsed, onBack, resetChrome, setChrome, setCollapsed, title]);
}

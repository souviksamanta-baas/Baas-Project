import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

export type HeaderChromeState = {
  collapseEnabled: boolean;
  collapsed: boolean;
  title: string | null;
};

type HeaderChromeContextValue = HeaderChromeState & {
  resetChrome: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setChrome: (next: Partial<HeaderChromeState>) => void;
};

const DEFAULT_STATE: HeaderChromeState = {
  collapseEnabled: false,
  collapsed: false,
  title: null,
};

const HeaderChromeContext = createContext<HeaderChromeContextValue | null>(null);

const NOOP_VALUE: HeaderChromeContextValue = {
  ...DEFAULT_STATE,
  resetChrome: () => undefined,
  setChrome: () => undefined,
  setCollapsed: () => undefined,
};

export function HeaderChromeProvider(props: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<HeaderChromeState>(DEFAULT_STATE);

  const setChrome = useCallback((next: Partial<HeaderChromeState>) => {
    setState((current) => {
      const collapseEnabled = next.collapseEnabled ?? current.collapseEnabled;
      return {
        ...current,
        ...next,
        collapseEnabled,
        collapsed:
          collapseEnabled === false
            ? false
            : (next.collapsed ?? current.collapsed),
      };
    });
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((current) => {
      if (!current.collapseEnabled || current.collapsed === collapsed) {
        return current;
      }

      return { ...current, collapsed };
    });
  }, []);

  const resetChrome = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      resetChrome,
      setChrome,
      setCollapsed,
    }),
    [resetChrome, setChrome, setCollapsed, state],
  );

  return <HeaderChromeContext.Provider value={value}>{props.children}</HeaderChromeContext.Provider>;
}

export function useHeaderChrome(): HeaderChromeContextValue {
  const context = useContext(HeaderChromeContext);
  if (!context) {
    throw new Error('useHeaderChrome must be used within HeaderChromeProvider');
  }

  return context;
}

export function useHeaderChromeOptional(): HeaderChromeContextValue {
  return useContext(HeaderChromeContext) ?? NOOP_VALUE;
}

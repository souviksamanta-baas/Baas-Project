import { createContext, useContext, type ReactElement, type ReactNode } from 'react';

import { useOwnerSession, type OwnerSessionState } from '../hooks/useOwnerSession';

const OwnerSessionContext = createContext<OwnerSessionState | null>(null);

export function OwnerSessionProvider(props: { children: ReactNode }): ReactElement {
  const session = useOwnerSession();

  return <OwnerSessionContext.Provider value={session}>{props.children}</OwnerSessionContext.Provider>;
}

export function useOwnerSessionContext(): OwnerSessionState {
  const context = useContext(OwnerSessionContext);

  if (!context) {
    throw new Error('useOwnerSessionContext must be used within OwnerSessionProvider');
  }

  return context;
}

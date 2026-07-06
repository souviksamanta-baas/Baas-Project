import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { useOwnerCopilot, type OwnerCopilotState } from '../hooks/useOwnerCopilot';
import { useOwnerSessionContext } from './OwnerSessionProvider';

const OwnerCopilotContext = createContext<OwnerCopilotState | null>(null);

export function OwnerCopilotProvider(props: { children: ReactNode }): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const copilot = useOwnerCopilot({
    businessCenterId: dashboard?.businessCenter?.id ?? null,
    organizationId: dashboard?.organization?.id ?? null,
  });

  return <OwnerCopilotContext.Provider value={copilot}>{props.children}</OwnerCopilotContext.Provider>;
}

export function useOwnerCopilotContext(): OwnerCopilotState {
  const value = useContext(OwnerCopilotContext);
  if (!value) {
    throw new Error('useOwnerCopilotContext must be used within OwnerCopilotProvider');
  }

  return value;
}

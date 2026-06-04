export interface OwnerDashboard {
  shouldOnboard: boolean;
  organization: {
    id: string;
    name: string;
    role: 'owner' | 'staff';
    timezone: string;
  } | null;
  whatsappConnection: {
    status: 'not_configured' | 'pending' | 'connected' | 'error' | 'disabled';
    phoneNumberId: string | null;
    displayPhoneNumber: string | null;
    verifiedAt: string | null;
    lastStatusCheckAt: string | null;
    lastError: string | null;
  };
  metrics: {
    contacts: number;
    openConversations: number;
    products: number;
    lowStockItems: number;
    pendingFollowUps: number;
  };
  emptyStates: string[];
}

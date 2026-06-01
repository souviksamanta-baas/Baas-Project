export interface OwnerDashboard {
  shouldOnboard: boolean;
  organization: {
    id: string;
    name: string;
    role: 'owner' | 'staff';
    timezone: string;
  } | null;
  metrics: {
    contacts: number;
    openConversations: number;
    products: number;
    lowStockItems: number;
    pendingFollowUps: number;
  };
  emptyStates: string[];
}

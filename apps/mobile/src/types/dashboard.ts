import type { BusinessHoursSettings } from './settings';
import type { CopiFeatureFlags } from './features';

export interface OwnerDashboard {
  shouldOnboard: boolean;
  features?: CopiFeatureFlags;
  organization: {
    aiAutoSend: boolean;
    businessHours: BusinessHoursSettings | null;
    id: string;
    name: string;
    role: 'owner' | 'staff';
    timezone: string;
    verticalId: string | null;
    followUpDelayHours: number;
  } | null;
  businessCenter: {
    aiAutoSend: boolean;
    businessHours: BusinessHoursSettings | null;
    id: string;
    name: string;
    timezone: string;
    followUpDelayHours: number;
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
    lowStockItems: number;
    messagesToday: number;
    openConversations: number;
    pendingAiDrafts: number;
    pendingFollowUps: number;
    products: number;
    weeklySalesCents: number;
  };
  emptyStates: string[];
}

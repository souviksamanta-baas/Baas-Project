export interface BusinessHoursSettings {
  days: number[];
  enabled: boolean;
  end: string;
  start: string;
  timezone: string;
}

export interface OwnerSettingsFormValues {
  aiAutoSend: boolean;
  businessHoursEnabled: boolean;
  businessHoursMode: 'all_days' | 'weekdays';
  businessHoursEnd: string;
  businessHoursStart: string;
  followUpDelayHours: string;
}

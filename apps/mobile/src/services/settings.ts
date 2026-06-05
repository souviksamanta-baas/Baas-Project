import { supabase } from '../lib/supabase';
import type { BusinessHoursSettings, OwnerSettingsFormValues } from '../types/settings';

export function createSettingsFormValues(params: {
  aiAutoSend: boolean;
  businessHours: BusinessHoursSettings | null;
  followUpDelayHours: number;
  timezone: string;
}): OwnerSettingsFormValues {
  const businessHours = params.businessHours;

  return {
    aiAutoSend: params.aiAutoSend,
    businessHoursEnabled: businessHours?.enabled ?? false,
    businessHoursEnd: businessHours?.end ?? '17:00',
    businessHoursMode: isAllDays(businessHours?.days) ? 'all_days' : 'weekdays',
    businessHoursStart: businessHours?.start ?? '09:00',
    followUpDelayHours: params.followUpDelayHours.toString(),
  };
}

export async function updateOwnerSettings(params: {
  formValues: OwnerSettingsFormValues;
  organizationId: string;
  timezone: string;
}): Promise<void> {
  const validationError = validateOwnerSettings(params.formValues);

  if (validationError) {
    throw new Error(validationError);
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      ai_auto_send: params.formValues.aiAutoSend,
      ai_follow_up_delay_hours: Number.parseInt(params.formValues.followUpDelayHours, 10),
      business_hours: toBusinessHoursSettings(params.formValues, params.timezone),
    })
    .eq('id', params.organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

export function validateOwnerSettings(values: OwnerSettingsFormValues): string | null {
  if (!/^\d+$/.test(values.followUpDelayHours.trim())) {
    return 'Follow-up delay must be a whole number of hours.';
  }

  const delay = Number.parseInt(values.followUpDelayHours, 10);

  if (delay < 0 || delay > 168) {
    return 'Follow-up delay must be between 0 and 168 hours.';
  }

  if (values.businessHoursEnabled) {
    if (!isTimeValue(values.businessHoursStart) || !isTimeValue(values.businessHoursEnd)) {
      return 'Business hours must use HH:MM format, like 09:00 and 17:00.';
    }

    if (values.businessHoursStart === values.businessHoursEnd) {
      return 'Business hours start and end cannot be the same time.';
    }
  }

  return null;
}

function toBusinessHoursSettings(
  values: OwnerSettingsFormValues,
  timezone: string,
): BusinessHoursSettings | null {
  if (!values.businessHoursEnabled) {
    return {
      days: [1, 2, 3, 4, 5],
      enabled: false,
      end: values.businessHoursEnd,
      start: values.businessHoursStart,
      timezone,
    };
  }

  return {
    days: values.businessHoursMode === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
    end: values.businessHoursEnd,
    start: values.businessHoursStart,
    timezone,
  };
}

function isTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function isAllDays(days: number[] | undefined): boolean {
  return Array.isArray(days) && days.length === 7;
}

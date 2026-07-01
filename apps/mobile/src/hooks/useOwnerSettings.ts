import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  createSettingsFormValues,
  updateOwnerSettings,
  validateOwnerSettings,
} from '../api/settings';
import type { OwnerDashboard } from '../types/dashboard';
import type { OwnerSettingsFormValues } from '../types/settings';

export interface OwnerSettingsState {
  errorMessage: string | null;
  formValues: OwnerSettingsFormValues;
  isSaving: boolean;
  saveSettings: () => Promise<void>;
  setFormValue: <Field extends keyof OwnerSettingsFormValues>(
    field: Field,
    value: OwnerSettingsFormValues[Field],
  ) => void;
}

export function useOwnerSettings(
  dashboard: OwnerDashboard | null,
): OwnerSettingsState {
  const organization = dashboard?.organization ?? null;
  const businessCenter = dashboard?.businessCenter ?? null;
  const [formValues, setFormValues] = useState<OwnerSettingsFormValues>(() =>
    createSettingsFormValues({
      aiAutoSend: businessCenter?.aiAutoSend ?? false,
      businessHours: businessCenter?.businessHours ?? null,
      followUpDelayHours: businessCenter?.followUpDelayHours ?? 24,
      timezone: businessCenter?.timezone ?? 'UTC',
    }),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormValues(
      createSettingsFormValues({
        aiAutoSend: businessCenter?.aiAutoSend ?? false,
        businessHours: businessCenter?.businessHours ?? null,
        followUpDelayHours: businessCenter?.followUpDelayHours ?? 24,
        timezone: businessCenter?.timezone ?? 'UTC',
      }),
    );
  }, [businessCenter]);

  async function saveSettings(): Promise<void> {
    if (!organization || !businessCenter) {
      return;
    }

    const validationError = validateOwnerSettings(formValues);

    if (validationError) {
      Alert.alert('Check settings', validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateOwnerSettings({
        businessCenterId: businessCenter.id,
        formValues,
        organizationId: organization.id,
        timezone: businessCenter.timezone,
      });
      Alert.alert('Settings saved', 'AI and follow-up settings have been updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      Alert.alert('Could not save settings', message);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    errorMessage,
    formValues,
    isSaving,
    saveSettings,
    setFormValue: (field, value) => {
      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: value,
      }));
    },
  };
}

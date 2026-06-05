import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  createSettingsFormValues,
  updateOwnerSettings,
  validateOwnerSettings,
} from '../services/settings';
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
  organization: OwnerDashboard['organization'],
): OwnerSettingsState {
  const [formValues, setFormValues] = useState<OwnerSettingsFormValues>(() =>
    createSettingsFormValues({
      aiAutoSend: organization?.aiAutoSend ?? false,
      businessHours: organization?.businessHours ?? null,
      followUpDelayHours: organization?.followUpDelayHours ?? 24,
      timezone: organization?.timezone ?? 'UTC',
    }),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormValues(
      createSettingsFormValues({
        aiAutoSend: organization?.aiAutoSend ?? false,
        businessHours: organization?.businessHours ?? null,
        followUpDelayHours: organization?.followUpDelayHours ?? 24,
        timezone: organization?.timezone ?? 'UTC',
      }),
    );
  }, [organization]);

  async function saveSettings(): Promise<void> {
    if (!organization) {
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
        formValues,
        organizationId: organization.id,
        timezone: organization.timezone,
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

import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { styles } from '../styles';

export function OnboardingScreen(props: {
  businessName: string;
  isSubmitting: boolean;
  onChangeBusinessName: (businessName: string) => void;
  onCreateOrganization: () => void;
}): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Create your business</Text>
      <Text style={styles.bodyText}>This creates your organization and links you as the owner.</Text>
      <TextInput
        onChangeText={props.onChangeBusinessName}
        placeholder="My Business"
        style={styles.input}
        value={props.businessName}
      />
      <PrimaryButton
        disabled={props.isSubmitting}
        label="Create business"
        onPress={props.onCreateOrganization}
      />
    </View>
  );
}

import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { useProfileChromeOptional } from '../context/ProfileChromeProvider';
import { PrimaryButton, TextField } from '../design-system';
import { useAndroidUnsavedBack } from '../hooks/useAndroidUnsavedBack';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

function formatProfilePhone(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+${digits}` : trimmed;
}

function resolveProfileEmail(user: { email?: string | null }): string {
  const email = user.email?.trim() ?? '';
  if (!email || /@auth\.nexolia\.app$/i.test(email)) {
    return '';
  }
  return email;
}

export function EditProfileScreen(props: { onBack: () => void }): ReactElement {
  const profileChrome = useProfileChromeOptional();
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initial, setInitial] = useState({ fullName: '', preferredName: '', phone: '' });

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) {
        return;
      }

      setEmail(resolveProfileEmail(user));
      const nextFullName = String(user.user_metadata?.full_name ?? '');
      const nextPreferredName = String(user.user_metadata?.preferred_name ?? '');
      const nextPhone = formatProfilePhone(
        user.user_metadata?.auth_phone ?? user.user_metadata?.phone ?? user.phone,
      );
      setFullName(nextFullName);
      setPreferredName(nextPreferredName);
      setPhone(nextPhone);
      setInitial({ fullName: nextFullName, preferredName: nextPreferredName, phone: nextPhone });
    });
  }, []);

  const dirty = useMemo(
    () =>
      fullName !== initial.fullName ||
      preferredName !== initial.preferredName ||
      phone !== initial.phone,
    [fullName, initial.fullName, initial.phone, initial.preferredName, phone, preferredName],
  );

  useAndroidUnsavedBack({ dirty, onDiscard: props.onBack });

  async function handleSave(): Promise<void> {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert('Nombre requerido', 'Ingresá tu nombre completo para continuar.');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          preferred_name: preferredName.trim() || null,
          phone: phone.trim() || null,
        },
      });

      if (error) {
        throw error;
      }

      await profileChrome.refreshProfile();
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
      props.onBack();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScreenContent title="Editar perfil">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle title="Editar perfil" />
        </View>
      </View>

      <Card style={styles.formCard}>
        <TextField
          editable={false}
          label="Email"
          placeholder="Sin correo en esta cuenta"
          value={email}
        />
        {!email ? (
          <Text style={styles.hint}>
            Esta sesión ingresó con teléfono, no con correo. Si te uniste por QR, el email
            queda en la cuenta con la que pediste el código por correo (son identidades distintas
            hasta que las vinculemos).
          </Text>
        ) : null}
        <TextField
          label="Nombre completo *"
          onChangeText={setFullName}
          placeholder="Tu nombre completo"
          value={fullName}
        />
        <TextField
          label="Nombre preferido"
          onChangeText={setPreferredName}
          placeholder="Cómo querés que te salude la app"
          value={preferredName}
        />
        <TextField
          keyboardType="phone-pad"
          label="Teléfono"
          onChangeText={setPhone}
          placeholder="+54…"
          value={phone}
        />
        <PrimaryButton
          disabled={isSaving}
          fullWidth
          label={isSaving ? 'Guardando…' : 'Guardar cambios'}
          onPress={() => void handleSave()}
        />
      </Card>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backPressable: {
    marginLeft: -6,
    marginTop: -4,
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    width: 28,
  },
  flex: {
    flex: 1,
  },
  formCard: {
    gap: 14,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 4,
  },
  hint: {
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
});

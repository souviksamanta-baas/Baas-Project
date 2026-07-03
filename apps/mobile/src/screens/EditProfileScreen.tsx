import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { TextField } from '../design-system';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

export function EditProfileScreen(props: { onBack: () => void }): ReactElement {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) {
        return;
      }

      setEmail(user.email ?? '');
      setFullName(String(user.user_metadata?.full_name ?? ''));
      setPhone(String(user.user_metadata?.phone ?? user.phone ?? ''));
    });
  }, []);

  async function handleSave(): Promise<void> {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert('Nombre requerido', 'Ingresá tu nombre para continuar.');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          phone: phone.trim() || null,
        },
      });

      if (error) {
        throw error;
      }

      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
      props.onBack();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScreenContent>
      <ScreenTitle subtitle="Actualizá tu información personal" title="Editar perfil" />
      <Pressable onPress={props.onBack}>
        <Text style={styles.backLink}>‹ Volver</Text>
      </Pressable>

      <Card style={styles.formCard}>
        <TextField editable={false} label="Email" value={email} />
        <TextField label="Nombre *" onChangeText={setFullName} placeholder="Tu nombre" value={fullName} />
        <TextField
          keyboardType="phone-pad"
          label="Teléfono"
          onChangeText={setPhone}
          placeholder="+54…"
          value={phone}
        />
        <PrimaryButton
          disabled={isSaving}
          label={isSaving ? 'Guardando…' : 'Guardar cambios'}
          onPress={() => void handleSave()}
        />
      </Card>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backLink: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
  },
  formCard: {
    gap: 14,
    padding: 16,
  },
});

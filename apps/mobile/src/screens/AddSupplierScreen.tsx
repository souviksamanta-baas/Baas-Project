import type { ReactElement } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ContactPickerModal } from '../components/ContactPickerModal';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, TextField } from '../design-system';
import { addSupplier } from '../lib/suppliers';
import { colors } from '../theme';

export function AddSupplierScreen(props: {
  onBack: () => void;
  onSaved: () => void;
}): ReactElement {
  const [comercio, setComercio] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await addSupplier({
        comercio,
        name,
        notes,
        phone,
        phoneE164,
      });
      props.onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScreenContent title="Agregar proveedor">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle title="Agregar proveedor" />
        </View>
      </View>

      <Card style={styles.formCard}>
        <Pressable onPress={() => setContactPickerOpen(true)} style={styles.contactLink}>
          <Text style={styles.contactLinkText}>+ Agregar desde contactos</Text>
        </Pressable>

        <TextField
          label="Comercio *"
          onChangeText={setComercio}
          placeholder="Nombre del comercio"
          value={comercio}
        />

        <TextField
          label="Nombre"
          onChangeText={setName}
          placeholder="Nombre y apellido"
          value={name}
        />

        <TextField
          keyboardType="phone-pad"
          label="Teléfono"
          onChangeText={(value) => {
            setPhone(value);
            setPhoneE164(null);
          }}
          placeholder="0351… o +54…"
          value={phone}
        />

        <TextField
          label="Notas"
          multiline
          onChangeText={setNotes}
          placeholder="Qué vende, días de entrega…"
          value={notes}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <PrimaryButton
          disabled={isSaving}
          fullWidth
          label={isSaving ? 'Guardando…' : 'Guardar proveedor'}
          onPress={() => void handleSave()}
        />
      </Card>

      <ContactPickerModal
        onClose={() => setContactPickerOpen(false)}
        onSelect={(contact) => {
          setName(contact.displayName);
          setPhone(contact.phoneE164 ?? contact.rawPhone);
          setPhoneE164(contact.phoneE164);
          setContactPickerOpen(false);
          setErrorMessage(null);
        }}
        visible={contactPickerOpen}
      />
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
  contactLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  contactLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
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
});

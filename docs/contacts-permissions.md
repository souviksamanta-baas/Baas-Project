# Contacts Permission and Privacy

Nexolia reads device contacts when the owner opens the contact picker (staff
invite, proveedores, CRM) and can **write** a single contact when using
**Agregar contacto** in a WhatsApp thread (device phonebook only — no new CRM
store).

## Behavior

- Permission is requested on first use via `expo-contacts`
  (`requestPermissionsAsync`)
- Read path uses the contacts API for pickers / “is this number already saved?”
- **Agregar contacto** calls `Contacts.addContactAsync` with display name + phone
- If denied, the user can still type a phone number manually where pickers apply
- Only the **selected** contact name and phone are sent to Nexolia APIs
- The full address book is never uploaded to Nexolia servers

## Staff invite

The owner taps **+ Agregar desde contactos** → branded picker (`ContactPickerModal`)
→ phone is normalized to E.164 → stored on `organization_invites.invited_phone_e164`.
The invited staff member must verify the **same** number when accepting the QR invite.

## CRM / clients

Reuse the same contact loader helpers in `apps/mobile/src/api/customers.ts` when
creating or editing CRM contacts, and in **Proveedores** (`SuppliersScreen`)
when importing a vendor from the phone book. Normalize Argentina formats (`011…`, `+5411…`,
`+54911…`) before save.

## Platforms

- **iOS / Android:** contacts permission copy is set in `apps/mobile/app.json`
  (`expo-contacts` plugin)
- **Web:** contact picker / write are unavailable; manual entry only

## Android

`android.permission.READ_CONTACTS` and `android.permission.WRITE_CONTACTS` are
declared in `apps/mobile/app.json` so Chats can save a number to the device
phonebook. WRITE is only used for **Agregar contacto** (user-initiated).

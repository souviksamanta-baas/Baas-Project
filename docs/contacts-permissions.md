# Contacts Permission and Privacy

Nexolia reads device contacts only when the owner explicitly opens the contact picker (staff invite or CRM contact creation).

## Behavior

- Permission is requested on first use via `expo-contacts` (`requestPermissionsAsync`)
- Contacts are loaded with the class API: `Contact.getAllDetails([FULL_NAME, PHONES])`
  (do not call deprecated `getContactsAsync` from the root package — it throws)
- If denied, the user can still type a phone number manually
- Only the **selected** contact name and phone are sent to the API
- The full address book is never uploaded to Nexolia servers

## Staff invite

The owner taps **+ Agregar desde contactos** → branded picker (`ContactPickerModal`)
→ phone is normalized to E.164 → stored on `organization_invites.invited_phone_e164`.
The invited staff member must verify the **same** number when accepting the QR invite.

## CRM / clients

Reuse the same contact loader helpers in `apps/mobile/src/api/customers.ts` when
creating or editing CRM contacts. Normalize Argentina formats (`011…`, `+5411…`,
`+54911…`) before save.

## Platforms

- **iOS / Android:** contacts permission copy is set in `apps/mobile/app.json`
  (`expo-contacts` plugin)
- **Web:** contact picker is unavailable; manual entry only

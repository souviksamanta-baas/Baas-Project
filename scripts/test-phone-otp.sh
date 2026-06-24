#!/usr/bin/env bash
# Smoke-test hosted Supabase phone OTP (KAN-129). Requires a Twilio-verified E.164 number.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <e164-phone> [otp-code]"
  echo "Example: $0 +54911XXXXXXXX"
  echo "Example: $0 +54911XXXXXXXX 123456"
  exit 1
fi

PHONE="$1"
OTP_CODE="${2:-}"

SUPABASE_URL="${SUPABASE_URL:-https://efcyejbvcskbnipwdfge.supabase.co}"
ANON_KEY="${SUPABASE_ANON_KEY:-${EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}}"

if [[ -z "${ANON_KEY}" ]]; then
  echo "Set SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  exit 1
fi

if [[ -z "${OTP_CODE}" ]]; then
  echo "Requesting OTP for ${PHONE}..."
  curl -sS -X POST "${SUPABASE_URL}/auth/v1/otp" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"${PHONE}\"}"
  echo
  echo "If successful, run again with the 6-digit code: $0 ${PHONE} <code>"
  exit 0
fi

echo "Verifying OTP for ${PHONE}..."
curl -sS -X POST "${SUPABASE_URL}/auth/v1/verify" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"sms\",\"phone\":\"${PHONE}\",\"token\":\"${OTP_CODE}\"}"
echo

#!/usr/bin/env bash
# Generate an ARCA/AFIP Web Services CSR for Nexolia using an existing private key.
#
# Usage:
#   ./scripts/generate-arca-csr.sh <CUIT_11_DIGITS> ["Razon Social"]
#
# Example:
#   ./scripts/generate-arca-csr.sh 30712345678 "Nexolia SAS"
#
# Output (gitignored):
#   secrets/arca/nexolia-arca.csr
#   secrets/arca/nexolia-arca-private.key  (created if missing)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/secrets/arca"
KEY_PATH="${OUT_DIR}/nexolia-arca-private.key"
CSR_PATH="${OUT_DIR}/nexolia-arca.csr"

CUIT_RAW="${1:-}"
ORG_NAME="${2:-Nexolia}"

if [[ -z "${CUIT_RAW}" ]]; then
  echo "Usage: $0 <CUIT_11_DIGITS> [\"Razon Social\"]" >&2
  exit 1
fi

CUIT="$(echo "${CUIT_RAW}" | tr -d ' -')"
if [[ ! "${CUIT}" =~ ^[0-9]{11}$ ]]; then
  echo "CUIT must be exactly 11 digits (got: ${CUIT_RAW})" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
chmod 700 "${OUT_DIR}"

if [[ ! -f "${KEY_PATH}" ]]; then
  echo "Generating 2048-bit RSA private key at ${KEY_PATH}"
  openssl genrsa -out "${KEY_PATH}" 2048
  chmod 600 "${KEY_PATH}"
fi

# AFIP/ARCA expects C=AR, O=legal name, CN=CUIT (11 digits, no dashes).
SUBJECT="/C=AR/O=${ORG_NAME}/CN=${CUIT}"
echo "Creating CSR with subject: ${SUBJECT}"
openssl req -new -key "${KEY_PATH}" -subj "${SUBJECT}" -out "${CSR_PATH}"
chmod 600 "${CSR_PATH}"

echo
echo "Done."
echo "  Private key: ${KEY_PATH}"
echo "  CSR:         ${CSR_PATH}"
echo
echo "Upload the CSR in ARCA (Administración de certificados digitales / WS)."
echo "Keep the private key offline — after ARCA returns the .crt, set:"
echo "  ARCA_PLATFORM_KEY_PEM  <- contents of nexolia-arca-private.key"
echo "  ARCA_PLATFORM_CERT_PEM <- contents of the certificate ARCA issues"
echo
openssl req -in "${CSR_PATH}" -noout -subject

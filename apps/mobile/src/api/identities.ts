import { normalizeEmail } from '../services/email';
import { normalizePhoneNumber } from '../services/phone';
import { apiFetchAuthJson } from './client';

export type IdentityMe = {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
};

export type MergeOrgPreview = {
  name: string;
  organizationId: string;
  role: string;
};

export type IdentityVerifyResult =
  | {
      identities: IdentityMe;
      status: 'linked';
    }
  | {
      mergeToken: string;
      organizations: MergeOrgPreview[];
      status: 'merge_required';
      warning: string;
    };

export async function getMyIdentities(): Promise<IdentityMe> {
  return apiFetchAuthJson<IdentityMe>('/auth/identities/me');
}

export async function requestEmailIdentityLink(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('Ingresá un correo válido.');
  }

  await apiFetchAuthJson('/auth/identities/email/request', {
    body: JSON.stringify({ email: normalized }),
    method: 'POST',
  });
}

export async function verifyEmailIdentityLink(params: {
  code: string;
  email: string;
}): Promise<IdentityVerifyResult> {
  const normalized = normalizeEmail(params.email);
  if (!normalized) {
    throw new Error('Ingresá un correo válido.');
  }

  const code = params.code.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Ingresá el código de 6 dígitos del correo.');
  }

  return apiFetchAuthJson<IdentityVerifyResult>('/auth/identities/email/verify', {
    body: JSON.stringify({ code, email: normalized }),
    method: 'POST',
  });
}

export async function requestPhoneIdentityLink(phone: string): Promise<void> {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
  }

  await apiFetchAuthJson('/auth/identities/phone/request', {
    body: JSON.stringify({ phone: normalized }),
    method: 'POST',
  });
}

export async function verifyPhoneIdentityLink(params: {
  code: string;
  phone: string;
}): Promise<IdentityVerifyResult> {
  const normalized = normalizePhoneNumber(params.phone);
  if (!normalized) {
    throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
  }

  const code = params.code.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Ingresá el código de 6 dígitos del SMS.');
  }

  return apiFetchAuthJson<IdentityVerifyResult>('/auth/identities/phone/verify', {
    body: JSON.stringify({ code, phone: normalized }),
    method: 'POST',
  });
}

/** @deprecated Use requestPhoneIdentityLink */
export async function requestWhatsAppIdentityLink(phone: string): Promise<void> {
  return requestPhoneIdentityLink(phone);
}

/** @deprecated Use verifyPhoneIdentityLink */
export async function verifyWhatsAppIdentityLink(params: {
  code: string;
  phone: string;
}): Promise<IdentityVerifyResult> {
  return verifyPhoneIdentityLink(params);
}

export async function confirmIdentityMerge(mergeToken: string): Promise<IdentityMe> {
  const result = await apiFetchAuthJson<{ identities: IdentityMe; status: 'linked' }>(
    '/auth/identities/confirm-merge',
    {
      body: JSON.stringify({ confirm: true, mergeToken }),
      method: 'POST',
    },
  );
  return result.identities;
}

/**
 * Shared Resend helpers for Nexolia admin / public transactional mail.
 */

type ResendSendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  logTag: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.NEXOLIA_AUTH_EMAIL_FROM?.trim() ||
    'Nexolia <noreply@nexolia.com.ar>';

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[${params.logTag}] Dev mode — email to ${redactEmail(params.to)} skipped (no RESEND_API_KEY).`,
      );
      return;
    }
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as ResendSendResponse;
  if (!response.ok) {
    const detail = body.message || body.name || `HTTP ${response.status}`;
    throw new Error(detail);
  }
}

/** Owner email when staff confirms / activates the organization in admin. */
export async function sendOwnerOrgConfirmedEmail(params: {
  email: string;
  orgName: string;
  planLabel?: string | null;
  licenseStatus?: string | null;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return;
  }

  const orgName = params.orgName.trim() || 'tu negocio';
  const planLabel = (params.planLabel ?? '').trim();
  const status = (params.licenseStatus ?? 'active').trim().toLowerCase();
  const statusLabel =
    status === 'trial'
      ? 'en prueba'
      : status === 'active'
        ? 'activa'
        : status;

  const appUrl =
    process.env.NEXOLIA_MOBILE_DOWNLOAD_URL?.trim() ||
    'https://nexolia.com.ar/comenzar';

  await sendResendEmail({
    logTag: 'admin-org-confirmed',
    to: email,
    subject: `Tu negocio «${orgName}» ya está confirmado en Nexolia`,
    html: [
      '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#101935;max-width:560px">',
      '<h2 style="margin:0 0 12px;color:#101935">Tu negocio ya está listo</h2>',
      `<p>Confirmamos <strong>${escapeHtml(orgName)}</strong> en Nexolia`,
      planLabel ? ` con el plan <strong>${escapeHtml(planLabel)}</strong>` : '',
      statusLabel ? ` (licencia <strong>${escapeHtml(statusLabel)}</strong>)` : '',
      '.</p>',
      '<p>Ya podés ingresar a la app con el mismo correo con el que te registraste y empezar a operar.</p>',
      '<p style="margin:24px 0">',
      `<a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#08bd66;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Ir a Nexolia</a>`,
      '</p>',
      '<p style="font-size:14px;color:#56627b">Si necesitás ayuda, respondé este correo o escribinos por WhatsApp desde la app.</p>',
      '</div>',
    ].join(''),
    text: [
      'Tu negocio ya está listo — Nexolia',
      '',
      `Confirmamos «${orgName}»${planLabel ? ` con el plan ${planLabel}` : ''}${
        statusLabel ? ` (licencia ${statusLabel})` : ''
      }.`,
      'Ya podés ingresar a la app con el mismo correo con el que te registraste.',
      '',
      appUrl,
    ].join('\n'),
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Load org + owner and send the confirmed/ready email (errors are logged, not thrown). */
export async function notifyOwnerOrgConfirmed(params: {
  // Minimal Supabase query client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (table: string) => any };
  organizationId: string;
}): Promise<void> {
  try {
    const { data: org, error } = await params.client
      .from('organizations')
      .select(
        'name, license_status, plans(display_name, slug), registered_owners(email)',
      )
      .eq('id', params.organizationId)
      .maybeSingle();

    if (error || !org) {
      throw new Error(error?.message ?? 'Organización no encontrada');
    }

    const owners = org.registered_owners as Array<{ email?: string }> | null;
    const ownerEmail = owners?.[0]?.email?.trim().toLowerCase();
    if (!ownerEmail) {
      console.warn(
        `[admin-org-confirmed] No owner email for org ${params.organizationId}`,
      );
      return;
    }

    const plans = org.plans as
      | { display_name?: string; slug?: string }
      | Array<{ display_name?: string; slug?: string }>
      | null;
    const plan = Array.isArray(plans) ? plans[0] : plans;

    await sendOwnerOrgConfirmedEmail({
      email: ownerEmail,
      orgName: String(org.name ?? ''),
      planLabel: plan?.display_name || plan?.slug || null,
      licenseStatus: org.license_status ?? null,
    });
  } catch (err) {
    console.error(
      `[admin-org-confirmed] failed for org ${params.organizationId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

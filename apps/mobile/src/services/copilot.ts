import { supabase } from '../lib/supabase';
import type { CopilotResponse } from '../types/copilot';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export async function askOwnerCopilot(params: {
  organizationId: string;
  question: string;
}): Promise<CopilotResponse> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required to ask the owner copilot.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sign in again before asking the owner copilot.');
  }

  const response = await fetch(`${apiBaseUrl}/ai/copilot/query`, {
    body: JSON.stringify(params),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Owner copilot failed with HTTP ${response.status}`);
  }

  return (await response.json()) as CopilotResponse;
}

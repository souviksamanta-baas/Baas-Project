import { Injectable, Logger } from '@nestjs/common';

interface OpenAiProject {
  id: string;
  name: string;
  object: string;
}

interface OpenAiServiceAccount {
  api_key?: {
    id?: string;
    name?: string;
    value?: string;
  } | null;
  id: string;
  name: string;
}

@Injectable()
export class OpenAiAdminClient {
  private readonly logger = new Logger(OpenAiAdminClient.name);
  private readonly baseUrl = 'https://api.openai.com/v1';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_ADMIN_KEY?.trim());
  }

  async createProject(name: string): Promise<OpenAiProject> {
    return this.requestJson<OpenAiProject>('/organization/projects', {
      body: JSON.stringify({ name }),
      method: 'POST',
    });
  }

  async createProjectServiceAccount(params: {
    name: string;
    projectId: string;
  }): Promise<OpenAiServiceAccount> {
    return this.requestJson<OpenAiServiceAccount>(
      `/organization/projects/${encodeURIComponent(params.projectId)}/service_accounts`,
      {
        body: JSON.stringify({ name: params.name }),
        method: 'POST',
      },
    );
  }

  /**
   * Hard monthly spend limit. threshold_amount is in cents.
   * @see https://developers.openai.com/api/docs/guides/spend-limits
   */
  async setProjectSpendLimit(params: {
    projectId: string;
    thresholdUsd: number;
  }): Promise<void> {
    const cents = Math.max(1, Math.round(params.thresholdUsd * 100));
    await this.requestJson(`/organization/projects/${encodeURIComponent(params.projectId)}/spend_limit`, {
      body: JSON.stringify({
        currency: 'USD',
        interval: 'month',
        threshold_amount: cents,
      }),
      method: 'POST',
    });
  }

  async archiveProject(projectId: string): Promise<void> {
    await this.requestJson(`/organization/projects/${encodeURIComponent(projectId)}`, {
      body: JSON.stringify({ status: 'archived' }),
      method: 'POST',
    }).catch((error) => {
      this.logger.warn(
        `Failed to archive OpenAI project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const adminKey = process.env.OPENAI_ADMIN_KEY?.trim();
    if (!adminKey) {
      throw new Error('OPENAI_ADMIN_KEY is not configured');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `OpenAI Admin API ${init.method ?? 'GET'} ${path} failed (${response.status}): ${errorBody.slice(0, 400)}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

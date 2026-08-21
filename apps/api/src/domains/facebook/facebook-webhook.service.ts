import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

import { SupabaseService } from '../../supabase/supabase.service';
import { FacebookEventProcessor } from './facebook-event-processor.service';

@Injectable()
export class FacebookWebhookService {
  private readonly logger = new Logger(FacebookWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly eventProcessor: FacebookEventProcessor,
  ) {}

  verifyChallenge(params: {
    mode?: string;
    challenge?: string;
    verifyToken?: string;
  }): string {
    const expected =
      this.configService.get<string>('FACEBOOK_VERIFY_TOKEN') ??
      this.configService.get<string>('META_VERIFY_TOKEN') ??
      this.configService.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (
      params.mode === 'subscribe' &&
      params.challenge &&
      expected &&
      params.verifyToken === expected
    ) {
      return params.challenge;
    }
    throw new ForbiddenException('Facebook webhook verification failed');
  }

  async handleWebhook(params: {
    rawBody: Buffer | undefined;
    signatureHeader?: string;
  }): Promise<{ accepted: true; queued: number }> {
    if (!params.rawBody || params.rawBody.length === 0) {
      throw new UnauthorizedException('Missing raw request body');
    }

    this.assertValidSignature(params.rawBody, params.signatureHeader);

    const payload = JSON.parse(params.rawBody.toString('utf8')) as {
      entry?: Array<{
        id?: string;
        messaging?: Array<{
          message?: { mid?: string; text?: string };
          recipient?: { id?: string };
          sender?: { id?: string };
          timestamp?: number;
        }>;
        time?: number;
      }>;
      object?: string;
    };

    if (payload.object !== 'page') {
      return { accepted: true, queued: 0 };
    }

    const client = this.supabaseService.getServiceRoleClient();
    const eventIds: string[] = [];

    for (const entry of payload.entry ?? []) {
      const pageId = entry.id ?? null;
      for (const event of entry.messaging ?? []) {
        const mid = event.message?.mid;
        if (!mid || !event.sender?.id) {
          continue;
        }

        const { data: existing } = await client
          .from('facebook_message_events')
          .select('id, processing_status')
          .eq('external_event_id', mid)
          .maybeSingle<{ id: string; processing_status: string | null }>();

        if (existing?.processing_status === 'processed') {
          continue;
        }
        if (existing?.id) {
          eventIds.push(existing.id);
          continue;
        }

        const config = pageId
          ? await client
              .from('facebook_config')
              .select('id, organization_id, business_center_id')
              .eq('page_id', pageId)
              .eq('connection_status', 'connected')
              .maybeSingle<{
                business_center_id: string;
                id: string;
                organization_id: string;
              }>()
          : { data: null };

        const { data: inserted, error } = await client
          .from('facebook_message_events')
          .insert({
            organization_id: config.data?.organization_id ?? null,
            business_center_id: config.data?.business_center_id ?? null,
            facebook_config_id: config.data?.id ?? null,
            page_id: pageId,
            external_event_id: mid,
            payload: event,
          })
          .select('id')
          .maybeSingle<{ id: string }>();

        if (error) {
          if (error.code === '23505') {
            const { data: raced } = await client
              .from('facebook_message_events')
              .select('id, processing_status')
              .eq('external_event_id', mid)
              .maybeSingle<{ id: string; processing_status: string | null }>();
            if (raced?.id && raced.processing_status !== 'processed') {
              eventIds.push(raced.id);
            }
            continue;
          }
          this.logger.warn(`Failed to store Facebook event ${mid}: ${error.message}`);
          continue;
        }

        if (inserted?.id) {
          eventIds.push(inserted.id);
        }
      }
    }

    this.eventProcessor.scheduleProcess(eventIds);
    return { accepted: true, queued: eventIds.length };
  }

  private assertValidSignature(rawBody: Buffer, signatureHeader?: string): void {
    const appSecret =
      this.configService.get<string>('META_APP_SECRET') ??
      this.configService.get<string>('FACEBOOK_APP_SECRET') ??
      this.configService.get<string>('WHATSAPP_APP_SECRET');
    if (!appSecret) {
      throw new UnauthorizedException('META_APP_SECRET is not configured');
    }
    if (!signatureHeader?.startsWith('sha256=')) {
      throw new UnauthorizedException('Missing Facebook signature');
    }

    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Facebook signature');
    }
  }
}

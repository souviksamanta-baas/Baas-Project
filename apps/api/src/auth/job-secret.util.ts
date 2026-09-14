import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function assertJobSecret(params: {
  expectedSecret: string | undefined;
  invalidMessage?: string;
  missingMessage?: string;
  providedSecret: string | undefined;
}): void {
  if (!params.expectedSecret) {
    throw new ServiceUnavailableException(
      params.missingMessage ?? 'Job secret is not configured',
    );
  }

  if (
    !params.providedSecret ||
    !timingSafeStringEqual(params.providedSecret, params.expectedSecret)
  ) {
    throw new UnauthorizedException(params.invalidMessage ?? 'Invalid job secret');
  }
}

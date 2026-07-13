import { describe, expect, it } from 'vitest';

import { COPI_CHAT_RETENTION_DAYS } from '../src/domains/ai/copi-session.service';

describe('Copi session retention', () => {
  it('keeps a 14-day chat window', () => {
    expect(COPI_CHAT_RETENTION_DAYS).toBe(14);
  });
});

import { describe, expect, it } from 'vitest';

import { escapeIlikePattern } from '../src/domains/admin/admin-leads.service';

describe('escapeIlikePattern', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeIlikePattern('100%_off\\now')).toBe('100\\%\\_off\\\\now');
  });
});

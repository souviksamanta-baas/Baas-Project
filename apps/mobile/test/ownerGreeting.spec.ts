import { describe, expect, it } from 'vitest';

import { resolveOwnerGreetingName } from '../src/lib/ownerGreeting';

describe('resolveOwnerGreetingName', () => {
  it('prefers preferred_name first word', () => {
    expect(
      resolveOwnerGreetingName({
        full_name: 'Souvik Samanta',
        preferred_name: 'Souvi Demo',
      }),
    ).toBe('Souvi');
  });

  it('falls back to first word of full_name', () => {
    expect(resolveOwnerGreetingName({ full_name: 'Souvik Samanta' })).toBe('Souvik');
  });

  it('returns empty string when no names exist', () => {
    expect(resolveOwnerGreetingName({})).toBe('');
  });
});

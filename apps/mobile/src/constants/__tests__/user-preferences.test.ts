import { describe, expect, it } from 'vitest';
import { UserPreferences } from '../user-preferences';

describe('UserPreferences', () => {
  it('exposes the expected spend agreement key', () => {
    expect(UserPreferences).toHaveProperty('spendAgreed', 'send-fund-agreed');
  });
});
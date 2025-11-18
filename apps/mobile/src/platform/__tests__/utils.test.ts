import { describe, expect, it, vi } from 'vitest';

let platformOS = 'ios';

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformOS;
    }
  }
}));

import { isIOS } from '../utils';

describe('isIOS', () => {
  it('returns true when Platform.OS === ios', () => {
    platformOS = 'ios';
    expect(isIOS()).toBe(true);
  });

  it('returns false when Platform.OS !== ios', () => {
    platformOS = 'android';
    expect(isIOS()).toBe(false);
  });
});

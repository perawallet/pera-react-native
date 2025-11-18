import { describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/utils', () => ({
  isIOS: vi.fn(),
}));

const loadFontFamilies = async (isOnIOS: boolean) => {
  vi.resetModules();
  const { isIOS } = await import('../../platform/utils');
  vi.mocked(isIOS).mockReturnValue(isOnIOS);
  const { fontFamilies } = await import('../fonts');
  return fontFamilies;
};

describe('fontFamilies', () => {
  it('returns the expected font names on iOS', async () => {
    const fontFamilies = await loadFontFamilies(true);

    expect(fontFamilies.DMSANS[300]).toBe('DMSans-Light');
    expect(fontFamilies.DMSANS[400]).toBe('DMSans-Regular');
    expect(fontFamilies.DMSANS[500]).toBe('DMSans-Medium');
    expect(fontFamilies.DMSANS[700]).toBe('DMSans-Bold');

    expect(fontFamilies.DMMONO[300]).toBe('DMMono-Regular');
    expect(fontFamilies.DMMONO[500]).toBe('DMMono-Medium');
    expect(fontFamilies.DMMONO[700]).toBe('DMMono-Medium');
  });

  it('returns the expected font names on Android', async () => {
    const fontFamilies = await loadFontFamilies(false);

    expect(fontFamilies.DMSANS[300]).toBe('DMSansLight');
    expect(fontFamilies.DMSANS[400]).toBe('DMSansRegular');
    expect(fontFamilies.DMSANS[500]).toBe('DMSansMedium');
    expect(fontFamilies.DMSANS[700]).toBe('DMSansBold');

    expect(fontFamilies.DMMONO[300]).toBe('DMMonoRegular');
    expect(fontFamilies.DMMONO[500]).toBe('DMMonoRegular');
    expect(fontFamilies.DMMONO[700]).toBe('DMMonoRegular');
  });
});
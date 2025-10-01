import { vi } from 'vitest';

// Mock core services and hooks from @perawallet/core
export const mockCoreServices = () => {
  vi.mock('@perawallet/core', async () => {
    const actual = await vi.importActual('@perawallet/core');
    return {
      ...actual,
      useDeviceInfoService: vi.fn(() => ({
        getDeviceLocale: vi.fn(() => 'en-US'),
        getDeviceInfo: vi.fn(() => ({
          brand: 'Apple',
          model: 'iPhone 13',
          systemVersion: '15.0',
        })),
      })),
      useAllAccounts: vi.fn(() => []),
      useHasAccounts: vi.fn(() => true),
      useHasNoAccounts: vi.fn(() => false),
      useAppStore: vi.fn(selector => {
        const mockState = {
          network: 'mainnet',
          fcmToken: null,
          setFcmToken: vi.fn(),
        };
        return selector ? selector(mockState) : mockState;
      }),
      formatCurrency: vi.fn((value, _, currency, __) => {
        return `${value.toString()} ${currency}`;
      }),
      Networks: {
        mainnet: 'mainnet',
        testnet: 'testnet',
      },
    };
  });
};

// Mock SVG components
export const mockSvgComponents = () => {
  vi.mock('../../../assets/icons/list-arrow-down.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../../assets/icons/plus-with-border.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../../assets/icons/camera.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../../assets/icons/bell.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../../assets/icons/info.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../../assets/icons/chevron-left.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../assets/icons/list-arrow-down.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../assets/icons/plus-with-border.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../assets/icons/camera.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../assets/icons/bell.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../assets/icons/info.svg', () => ({
    default: vi.fn(() => null),
  }));

  vi.mock('../../assets/icons/chevron-left.svg', () => ({
    default: vi.fn(() => null),
  }));
};

// Mock React Query persister
export const mockQueryPersister = () => ({
  persistClient: vi.fn(),
  restoreClient: vi.fn(),
  removeClient: vi.fn(),
});

// Mock navigation hooks with useful defaults
export const mockNavigation = () => ({
  navigate: vi.fn(),
  goBack: vi.fn(),
  reset: vi.fn(),
  setOptions: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  isFocused: vi.fn(() => true),
});

export const mockRoute = () => ({
  key: 'test-route',
  name: 'TestScreen',
  params: {},
});

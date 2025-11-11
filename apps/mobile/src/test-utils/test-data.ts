/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Decimal } from 'decimal.js';
import { vi } from 'vitest';

// Mock wallet account data
export const mockWalletAccount = {
  id: 'test-account-1',
  address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR',
  name: 'Test Account 1',
  balance: new Decimal('100.5'),
  assets: [],
  type: 'standard' as const,
  isWatchOnly: false,
};

export const mockWalletAccounts = [
  mockWalletAccount,
  {
    id: 'test-account-2',
    address: 'ZYXWVUTSRQPONMLKJIHGFEDCBA0987654321ZYXWVUTSRQPONMLKJIH',
    name: 'Test Account 2',
    balance: new Decimal('250.75'),
    assets: [],
    type: 'standard' as const,
    isWatchOnly: false,
  },
  {
    id: 'test-account-3',
    address: 'MNBVCXZASDFGHJKLPOIUYTREWQ1357902468MNBVCXZASDFGHJKLPOI',
    name: 'Watch Only Account',
    balance: new Decimal('0'),
    assets: [],
    type: 'watch' as const,
    isWatchOnly: true,
  },
];

// Mock asset data
export const mockAsset = {
  id: 123456,
  name: 'Test Token',
  unitName: 'TT',
  decimals: 6,
  total: new Decimal('1000000'),
  url: 'https://example.com',
  metadataHash: 'ABC123',
  defaultFrozen: false,
  manager: 'MANAGER_ADDRESS',
  reserve: 'RESERVE_ADDRESS',
  freeze: 'FREEZE_ADDRESS',
  clawback: 'CLAWBACK_ADDRESS',
};

// Mock currency values
export const mockCurrencyValues = {
  algo: new Decimal('100.50'),
  usd: new Decimal('25.75'),
  btc: new Decimal('0.001'),
};

// Mock device info
export const mockDeviceInfo = {
  brand: 'Apple',
  model: 'iPhone 13',
  systemVersion: '15.0',
  appVersion: '1.0.0',
  buildNumber: '100',
  deviceId: 'test-device-id',
  locale: 'en-US',
  timeZone: 'America/New_York',
};

// Mock network configurations
export const mockNetworks = {
  mainnet: {
    id: 'mainnet',
    name: 'MainNet',
    algodUrl: 'https://mainnet-api.algonode.cloud',
    indexerUrl: 'https://mainnet-idx.algonode.cloud',
    isTestNet: false,
  },
  testnet: {
    id: 'testnet',
    name: 'TestNet',
    algodUrl: 'https://testnet-api.algonode.cloud',
    indexerUrl: 'https://testnet-idx.algonode.cloud',
    isTestNet: true,
  },
};

// Mock platform service responses
export const mockPlatformServices = {
  secureStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(true),
    removeItem: vi.fn().mockResolvedValue(true),
    authenticate: vi.fn().mockResolvedValue(true),
  },
  keyValueStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getJSON: vi.fn().mockReturnValue(null),
    setJSON: vi.fn(),
  },
  deviceInfo: {
    getDeviceInfo: vi.fn().mockReturnValue(mockDeviceInfo),
    getDeviceLocale: vi.fn().mockReturnValue('en-US'),
  },
};

// Helper to create test props with defaults
export const createTestProps = <T extends Record<string, any>>(
  overrides: Partial<T> = {} as Partial<T>,
) => {
  const defaults = {
    testID: 'test-component',
    accessibilityLabel: 'Test Component',
    ...overrides,
  };
  return defaults as unknown as T;
};

// Helper to create mock component props
export const createMockButtonProps = (overrides = {}) => ({
  title: 'Test Button',
  variant: 'primary' as const,
  onPress: vi.fn(),
  testID: 'test-button',
  ...overrides,
});

export const createMockCurrencyDisplayProps = (overrides = {}) => ({
  currency: 'ALGO',
  value: new Decimal('100.5'),
  precision: 2,
  testID: 'test-currency-display',
  ...overrides,
});

export const createMockAccountListProps = (overrides = {}) => ({
  accounts: mockWalletAccounts,
  onAccountPress: vi.fn(),
  testID: 'test-account-list',
  ...overrides,
});

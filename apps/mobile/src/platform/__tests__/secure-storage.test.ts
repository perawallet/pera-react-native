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

import { RNSecureStorageService } from '../secure-storage';

const mockKeychain = vi.hoisted(() => ({
  setGenericPassword: vi.fn(async () => true),
  getGenericPassword: vi.fn(),
  resetGenericPassword: vi.fn(async () => true),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
  },
  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SecureHardware',
  },
}));

vi.mock('react-native-keychain', () => mockKeychain);

describe('RNSecureStorageService', () => {
  let service: RNSecureStorageService;

  beforeEach(() => {
    service = new RNSecureStorageService();
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('sets default options', async () => {
      service.initialize();

      // Test by calling setItem and checking the options passed to Keychain
      await service.setItem('test-key', Buffer.from('test-value'));

      expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
        'user',
        'test-value',
        expect.objectContaining({
          service: 'com.algorand.android.test-key',
          accessible: 'WhenUnlockedThisDeviceOnly',
          accessControl: 'BiometryCurrentSet',
          securityLevel: 'SecureHardware',
          authenticationPrompt: {
            title: 'Authenticate',
            description: 'Access secure data',
          },
        }),
      );
    });

    it('accepts custom options', async () => {
      service.initialize({
        service: 'custom.service',
        requireBiometrics: false,
        promptTitle: 'Custom Title',
        promptDesc: 'Custom Description',
      });

      await service.setItem('test-key', Buffer.from('test-value'));

      expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
        'user',
        'test-value',
        expect.objectContaining({
          service: 'custom.service.test-key',
          accessible: 'WhenUnlockedThisDeviceOnly',
          accessControl: undefined, // biometrics disabled
          securityLevel: 'SecureHardware',
          authenticationPrompt: {
            title: 'Custom Title',
            description: 'Custom Description',
          },
        }),
      );
    });
  });

  describe('setItem', () => {
    it('stores value with service-specific key', async () => {
      service.initialize();
      await service.setItem('my-key', Buffer.from('my-value'));

      expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
        'user',
        'my-value',
        expect.objectContaining({
          service: 'com.algorand.android.my-key',
        }),
      );
    });
  });

  describe('getItem', () => {
    it('returns stored value', async () => {
      service.initialize();

      // Mock successful retrieval
      mockKeychain.getGenericPassword.mockResolvedValue({
        service: 'com.algorand.android.my-key',
        username: 'user',
        password: 'stored-value',
        storage: 'KC' as any,
      });

      const result = await service.getItem('my-key');

      expect(result).toEqual(Buffer.from('stored-value'));
      expect(mockKeychain.getGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'com.algorand.android.my-key',
        }),
      );
    });

    it('returns null when no value found', async () => {
      service.initialize();

      // Mock no credentials found
      mockKeychain.getGenericPassword.mockResolvedValue(false);

      const result = await service.getItem('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('removes stored value', async () => {
      service.initialize();
      await service.removeItem('my-key');

      expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'com.algorand.android.my-key',
        }),
      );
    });
  });

  describe('authenticate', () => {
    it('returns true', async () => {
      service.initialize();

      // Mock existing auth probe
      mockKeychain.getGenericPassword.mockResolvedValue({
        service: 'com.algorand.android.auth_probe',
        username: 'user',
        password: '1',
        storage: 'KC' as any,
      });

      const result = await service.authenticate();

      expect(result).toBe(true);
    });
  });
});

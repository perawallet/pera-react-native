import { describe, test, expect, vi, beforeEach } from 'vitest'
import { RNSecureStorageService } from '../secure-storage'
import * as Keychain from 'react-native-keychain'

// Mock react-native-keychain
vi.mock('react-native-keychain', () => ({
  setGenericPassword: vi.fn(),
  getGenericPassword: vi.fn(),
  resetGenericPassword: vi.fn(),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
  },
  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SecureHardware',
  },
  STORAGE_TYPE: {
    KC: 'KC',
  },
}))

describe('RNSecureStorageService', () => {
  let service: RNSecureStorageService

  beforeEach(() => {
    service = new RNSecureStorageService()
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    test('sets default options', async () => {
      await service.initialize()

      // Test by calling setItem and checking the options passed to Keychain
      await service.setItem('test-key', 'test-value')

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
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
        })
      )
    })

    test('accepts custom options', async () => {
      await service.initialize({
        service: 'custom.service',
        requireBiometrics: false,
        promptTitle: 'Custom Title',
        promptDesc: 'Custom Description',
      })

      await service.setItem('test-key', 'test-value')

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
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
        })
      )
    })
  })

  describe('setItem', () => {
    test('stores value with service-specific key', async () => {
      await service.initialize()
      await service.setItem('my-key', 'my-value')

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'user',
        'my-value',
        expect.objectContaining({
          service: 'com.algorand.android.my-key',
        })
      )
    })
  })

  describe('getItem', () => {
    test('returns stored value', async () => {
      await service.initialize()
      
      // Mock successful retrieval
      vi.mocked(Keychain.getGenericPassword).mockResolvedValue({
        service: 'com.algorand.android.my-key',
        username: 'user',
        password: 'stored-value',
        storage: 'KC' as any,
      })

      const result = await service.getItem('my-key')
      
      expect(result).toBe('stored-value')
      expect(Keychain.getGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'com.algorand.android.my-key',
        })
      )
    })

    test('returns null when no value found', async () => {
      await service.initialize()
      
      // Mock no credentials found
      vi.mocked(Keychain.getGenericPassword).mockResolvedValue(false)

      const result = await service.getItem('non-existent-key')
      
      expect(result).toBeNull()
    })
  })

  describe('removeItem', () => {
    test('removes stored value', async () => {
      await service.initialize()
      await service.removeItem('my-key')

      expect(Keychain.resetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'com.algorand.android.my-key',
        })
      )
    })
  })

  describe('authenticate', () => {
    test('returns true when authentication succeeds with existing probe', async () => {
      await service.initialize()
      
      // Mock existing auth probe
      vi.mocked(Keychain.getGenericPassword).mockResolvedValue({
        service: 'com.algorand.android.auth_probe',
        username: 'user',
        password: '1',
        storage: 'KC' as any,
      })

      const result = await service.authenticate()
      
      expect(result).toBe(true)
      expect(Keychain.getGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'com.algorand.android.auth_probe',
        })
      )
    })

    test('returns true when creating new auth probe succeeds', async () => {
      await service.initialize()
      
      // Mock no existing probe, then successful creation and retrieval
      vi.mocked(Keychain.getGenericPassword)
        .mockResolvedValueOnce(false) // First call - no existing probe
        .mockResolvedValueOnce({ // Second call - successful retrieval after creation
          service: 'com.algorand.android.auth_probe',
          username: 'user',
          password: '1',
          storage: 'KC' as any,
        })

      const result = await service.authenticate()
      
      expect(result).toBe(true)
      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'user',
        '1',
        expect.objectContaining({
          service: 'com.algorand.android.auth_probe',
        })
      )
      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(2)
    })

    test('returns false when authentication fails', async () => {
      await service.initialize()
      
      // Mock keychain operations throwing (e.g., user cancelled biometric prompt)
      vi.mocked(Keychain.getGenericPassword).mockRejectedValue(
        new Error('User cancelled authentication')
      )

      const result = await service.authenticate()
      
      expect(result).toBe(false)
    })

    test('returns false when probe creation fails but initial read returns false', async () => {
      await service.initialize()
      
      // Mock no existing probe, creation succeeds, but final read fails
      vi.mocked(Keychain.getGenericPassword)
        .mockResolvedValueOnce(false) // First call - no existing probe
        .mockResolvedValueOnce(false) // Second call - failed to read after creation

      const result = await service.authenticate()
      
      expect(result).toBe(false)
    })
  })
})
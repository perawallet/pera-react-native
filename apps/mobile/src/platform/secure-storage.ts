import * as Keychain from 'react-native-keychain';
import type { SecureStorageService } from '@perawallet/core';

const SERVICE_PREFIX = 'com.algorand.android';

type Options = {
  service?: string;
  requireBiometrics?: boolean;
  promptTitle?: string;
  promptDesc?: string;
};

export class RNSecureStorageService implements SecureStorageService {
  private baseOpts: Keychain.SetOptions = {};

  async initialize(options: Options = {}) {
    const {
      service = SERVICE_PREFIX,
      requireBiometrics = true,
      promptTitle = 'Authenticate',
      promptDesc = 'Access secure data',
    } = options;

    this.baseOpts = {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl: requireBiometrics
        ? Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET
        : undefined,
      authenticationPrompt: {
        title: promptTitle,
        description: promptDesc,
      },
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
    };
  }

  async setItem(key: string, value: Buffer): Promise<void> {
    await Keychain.setGenericPassword('user', value.toString('utf-8'), {
      ...this.baseOpts,
      service: `${this.baseOpts.service}.${key}`,
    });
  }

  async getItem(key: string): Promise<Buffer | null> {
    const creds = await Keychain.getGenericPassword({
      ...this.baseOpts,
      service: `${this.baseOpts.service}.${key}`,
    })
    return creds ? Buffer.from(creds.password, 'utf-8') : null
  }

  async removeItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({
      ...this.baseOpts,
      service: `${this.baseOpts.service}.${key}`,
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Probe authentication by attempting to read a dedicated key.
      const probeService = `${this.baseOpts.service}.auth_probe`;
      const creds = await Keychain.getGenericPassword({
        ...this.baseOpts,
        service: probeService,
      });
      if (!creds) {
        // store a dummy value to trigger secure enclave policy
        await Keychain.setGenericPassword('user', '1', {
          ...this.baseOpts,
          service: probeService,
        });
        // read again to enforce biometric prompt immediately
        const after = await Keychain.getGenericPassword({
          ...this.baseOpts,
          service: probeService,
        });
        return !!after;
      }
      return true;
    } catch {
      return false;
    }
  }
}

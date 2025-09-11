import remoteConfig from '@react-native-firebase/remote-config';
import {
  RemoteConfigKey,
  RemoteConfigService,
} from '@perawallet/core';

export class RNRemoteConfigService implements RemoteConfigService {
  async initialize() {
    // Configure fetch interval (1 hour)
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: 60 * 60 * 1000,
    });

    // TODO: setup defaults here but load them from somewhere central? Config?
    await remoteConfig().setDefaults({});

    try {
      await remoteConfig().fetchAndActivate();
    } catch {
      // ignore fetch errors, rely on cached/default values
    }
  }

  getStringValue(key: RemoteConfigKey, fallback?: string): string {
    try {
      return remoteConfig().getValue(key).asString() || fallback || '';
    } catch {
      return fallback || '';
    }
  }
  getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean {
    try {
      return remoteConfig().getValue(key).asBoolean();
    } catch {
      return fallback || false;
    }
  }
  getNumberValue(key: RemoteConfigKey, fallback?: number): number {
    try {
      return remoteConfig().getValue(key).asNumber();
    } catch {
      return fallback || 0;
    }
  }
}

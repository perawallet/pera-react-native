import { DeviceInfoService, DevicePlatform } from '@perawallet/core';
import DeviceInfo from 'react-native-device-info';
import { Platform, NativeModules } from 'react-native';

export class RNDeviceInfoStorageService implements DeviceInfoService {
  initializeDeviceInfo(): void {}
  getDeviceID(): Promise<string> {
    return DeviceInfo.getUniqueId();
  }
  getDeviceModel(): string {
    return DeviceInfo.getDeviceId();
  }
  async getDevicePlatform(): Promise<DevicePlatform> {
    return (await DeviceInfo.getBaseOs()).toLowerCase() as DevicePlatform;
  }
  getDeviceLocale(): string {
    const deviceLanguage =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager.settings.AppleLocale ||
          NativeModules.SettingsManager.settings.AppleLanguages[0]
        : NativeModules.I18nManager.localeIdentifier;
    return deviceLanguage;
  }
}

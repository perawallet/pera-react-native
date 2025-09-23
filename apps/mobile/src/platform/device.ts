import { DeviceInfoService, DevicePlatform, updateBackendHeaders } from '@perawallet/core';
import DeviceInfo from 'react-native-device-info';
import { Platform, NativeModules } from 'react-native';

const findDeviceLocale = () => {
    const deviceLanguage =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager.settings.AppleLocale ||
          NativeModules.SettingsManager.settings.AppleLanguages[0]
        : NativeModules.I18nManager.localeIdentifier;
    return deviceLanguage;
}

export class RNDeviceInfoStorageService implements DeviceInfoService {
  initializeDeviceInfo(): void {
     DeviceInfo.getBaseOs().then((os) => {
        const headers = new Map<string, string>()
        headers.set('App-Name', DeviceInfo.getApplicationName())
        headers.set('App-Package-Name', DeviceInfo.getBundleId())
        headers.set('App-Version', DeviceInfo.getVersion())
        headers.set('Client-Type', DeviceInfo.getSystemName())
        headers.set('Device-Version', findDeviceLocale())
        headers.set('Device-OS-Version', DeviceInfo.getSystemVersion())
        headers.set('Device-Model', DeviceInfo.getDeviceId())
        

        updateBackendHeaders(headers)
    })
  }
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
    return findDeviceLocale()
  }
}

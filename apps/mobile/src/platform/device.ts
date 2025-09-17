import { DeviceInfoService, DevicePlatform } from "@perawallet/core";
import DeviceInfo from 'react-native-device-info';

export class RNDeviceInfoStorageService implements DeviceInfoService {
    initializeDeviceInfo(): void {}
    getDeviceID(): Promise<string> {
        return DeviceInfo.getUniqueId()
    }
    getDeviceModel(): string {
        return DeviceInfo.getDeviceId()
    }
    async getDevicePlatform(): Promise<DevicePlatform> {
        return (await DeviceInfo.getBaseOs()).toLowerCase() as DevicePlatform
    }
}
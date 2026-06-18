import { requireOptionalNativeModule } from 'expo'

export type PeraBluetoothModule = {
    requestEnable(): Promise<boolean>
}

export const PeraBluetooth =
    requireOptionalNativeModule<PeraBluetoothModule>('PeraBluetooth')

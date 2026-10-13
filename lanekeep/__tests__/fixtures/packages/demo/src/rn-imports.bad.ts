import { Platform } from 'react-native'
import type { AppStateStatus } from 'react-native'
import { subtle } from 'react-native-quick-crypto'
import * as Device from 'expo-device'
import { registerRootComponent } from 'expo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { storage } from '@algorandfoundation/react-native-keystore'
export { FalconModule } from '@joe-p/react-native-falcon'
export const loadMmkv = () => import('react-native-mmkv')
export const loadAssets = () => require('@react-native/assets-registry')

export const all = (state: AppStateStatus) => [
    Platform,
    state,
    subtle,
    Device,
    registerRootComponent,
    AsyncStorage,
    storage,
]

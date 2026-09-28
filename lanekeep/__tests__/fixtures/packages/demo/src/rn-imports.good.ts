import { getProvider } from '@perawallet/wallet-extension-provider'
import { lookalike } from 'reactive-native'
import { expose } from 'expose'
import { local } from './react-native'

declare const mock: (specifier: string) => void
mock('react-native')

export const isIOS = () =>
    getProvider().deviceInfo.getDevicePlatform() === 'ios'
export const all = [lookalike, expose, local]

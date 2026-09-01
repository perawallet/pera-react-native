import type { Platform } from '@perawallet/wallet-extension-platform-chrome'
import { type Keystore } from '@perawallet/wallet-extension-keystore-chrome'
import { getProvider } from '@perawallet/wallet-extension-platform'

export type Wiring = { p: Platform; k: Keystore }
export const boot = () => getProvider()

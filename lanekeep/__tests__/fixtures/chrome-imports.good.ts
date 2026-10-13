import type { Platform } from '@perawallet/wallet-extension-platform-chrome'
import { type Keystore } from '@perawallet/wallet-extension-keystore-chrome'
import { getProvider } from '@perawallet/wallet-extension-platform'
import type { ExpandedFlow } from '@perawallet/wallet-core-browser-runtime'

export type Wiring = { p: Platform; k: Keystore; f: ExpandedFlow }
export const boot = () => getProvider()

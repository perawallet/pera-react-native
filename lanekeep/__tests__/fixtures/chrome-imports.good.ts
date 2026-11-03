import type { Platform } from '@perawallet/wallet-extension-platform-chrome'
import { type PasskeyKeyStore } from '@perawallet/wallet-extension-vault-chrome'
import { getProvider } from '@perawallet/wallet-extension-platform'
import type { ExpandedFlow } from '@perawallet/wallet-core-browser-runtime'

export type Wiring = { p: Platform; k: PasskeyKeyStore; f: ExpandedFlow }
export const boot = () => getProvider()

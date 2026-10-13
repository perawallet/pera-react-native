import { getPlatform } from '@perawallet/wallet-extension-platform-chrome'
import { openKeystore } from '@perawallet/wallet-extension-keystore-chrome/storage'
import { openExpandedTab } from '@perawallet/wallet-core-browser-runtime'

export const boot = () => [getPlatform(), openKeystore(), openExpandedTab]

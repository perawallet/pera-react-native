import { getPlatform } from '@perawallet/wallet-extension-platform-chrome'
import { createVault } from '@perawallet/wallet-extension-vault-chrome'
import { openExpandedTab } from '@perawallet/wallet-core-browser-runtime'

export const boot = () => [getPlatform(), createVault, openExpandedTab]

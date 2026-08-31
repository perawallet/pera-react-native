import { getPlatform } from '@perawallet/wallet-extension-platform-chrome'
import { openKeystore } from '@perawallet/wallet-extension-keystore-chrome/storage'

export const boot = () => [getPlatform(), openKeystore()]

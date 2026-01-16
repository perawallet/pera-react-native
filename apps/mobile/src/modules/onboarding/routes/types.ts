import { WalletAccount } from '@perawallet/wallet-core-accounts'

export type OnboardingStackParamList = {
  OnboardingHome: undefined
  NameAccount: {
    account?: WalletAccount
  }
  ImportAccount: undefined
}

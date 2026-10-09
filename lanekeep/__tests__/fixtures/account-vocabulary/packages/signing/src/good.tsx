import { addressOn, hasCustody } from '@perawallet/wallet-core-accounts'
import { SeedScheme } from '@perawallet/wallet-core-kms'
export const watch = (account: never) => hasCustody(account, 'watch')
export const send = (account: never, scope: never) => addressOn(account, scope)
export const draft = (d: { multisigDetails: unknown }) => d.multisigDetails
export const root = SeedScheme.Bip39
// AccountTypes in a comment is not code.
export const capability = { platform: 'quantum', anyChain: 'quantumAccounts' }
export const row = { testID: 'quantum', leftIcon: 'quantum' as IconName }
export const icon = <PWIcon name='quantum' />
export const copy = 'onboarding.add_account.quantum_account_option_title'

import { addressOn, hasCustody } from '@perawallet/wallet-core-accounts'
import { SeedScheme } from '@perawallet/wallet-core-kms'
export const watch = (account: never) => hasCustody(account, 'watch')
export const send = (account: never, scope: never) => addressOn(account, scope)
export const draft = (d: { multisigDetails: unknown }) => d.multisigDetails
export const seed = SeedScheme.Quantum
// AccountTypes in a comment is not code.

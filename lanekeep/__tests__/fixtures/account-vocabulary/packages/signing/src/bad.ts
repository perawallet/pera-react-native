import {
    AccountTypes,
    isQuantumAccount,
} from '@perawallet/wallet-core-accounts'
export const kind = AccountTypes.watch
export const send = (account: { address: string }) => isQuantumAccount(account)
export type Held = HDWalletAccount
export const hdWalletDetails = undefined
export type Solo = StandaloneAccount
export const solo = (account: never) => isStandaloneAccount(account)
export const keyed = { hdWalletDetails: undefined }
export const short = (hdWalletDetails: never) => ({ hdWalletDetails })
export interface Legacy {
    hdWalletDetails: unknown
}
export const viaNamespace = (accounts: never, a: never) =>
    accounts.isQuantumAccount(a)
export const seed = SeedScheme.Quantum
export const isQuantum = (custody: { seed: string }) => custody.seed === 'quantum'
export type Kind = 'hdWallet' | 'standalone'
export const pick = (resolve: (k: string) => void) => resolve('algo25')
export const fee = (microAlgos: bigint) => microAlgos
export const shims = { falcon: undefined }
export const rekeyed = (a: never) => useRekeyAccount(a)

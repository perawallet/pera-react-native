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

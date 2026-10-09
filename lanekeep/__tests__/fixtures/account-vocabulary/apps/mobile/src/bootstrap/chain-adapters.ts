import { isQuantumAccount } from '@perawallet/wallet-core-chain-algorand'
export const quantum = (account: never) => isQuantumAccount(account)

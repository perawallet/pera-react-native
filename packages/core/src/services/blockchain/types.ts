import type { Transaction } from '@api/generated/indexer'

export const Networks = {
    testnet: 'testnet',
    mainnet: 'mainnet',
} as const

export type Network = (typeof Networks)[keyof typeof Networks]

export type SignRequest = TransactionSignRequest

type TransactionSignRequest = {
    id?: string
    // A list of transaction groups (which in turn are a list of transactions)
    //TODO determine if this is the right transactino type to use...maybe we should use the algosdk one?
    txs: Transaction[][]
}

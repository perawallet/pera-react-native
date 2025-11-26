export const Networks = {
    testnet: 'testnet',
    mainnet: 'mainnet',
} as const

export type Network = (typeof Networks)[keyof typeof Networks]

export type HistoryPeriod = 'one-year' | 'one-month' | 'one-week' | 'one-day'

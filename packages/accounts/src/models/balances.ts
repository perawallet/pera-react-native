import Decimal from 'decimal.js'

export type AssetWithAccountBalance = {
    assetId: string
    cryptoAmount: Decimal
    fiatAmount: Decimal
}

export type AccountBalancesWithTotals = {
    accountBalances: AccountBalances
    portfolioAlgoBalance: Decimal
    portfolioFiatBalance: Decimal
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export type AccountBalances = Map<
    string,
    {
        assetBalances: AssetWithAccountBalance[]
        algoBalance: Decimal
        fiatBalance: Decimal
        isPending: boolean
        isFetched: boolean
        isRefetching: boolean
        isError: boolean
    }
>

export type AccountBalanceResponse = {
    results: AccountAssetBalanceResponse[]
}

export type AccountAssetBalanceResponse = {
    asset_id: string
    amount: string
    fraction_decimals: number
    balance_usd_value: string
}

export type AccountBalanceHistoryItem = {
    datetime: Date
    fiatValue: Decimal
    algoValue: Decimal
    round: number
}

export type AccountBalanceHistoryResponseItem = {
    datetime: string
    usd_value: string
    algo_value: string
    round: number
}

export type AccountBalanceHistoryResponse = {
    results: AccountBalanceHistoryResponseItem[]
}

export type AccountAssetBalanceHistoryItem = {
    datetime: string
    algoValue: Decimal
    fiatValue: Decimal
    round: number
}

export type AccountAssetsBalanceHistory = AccountAssetBalanceHistoryItem[]

export type AccountAssetBalanceHistoryResponseItem = {
    datetime: string
    algo_value: string
    usd_value: string
    round: number
}

export type AccountAssetBalanceHistoryResponse = {
    next: string | null
    previous: string | null
    results: AccountAssetBalanceHistoryResponseItem[]
}


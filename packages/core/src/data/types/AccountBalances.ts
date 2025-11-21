import type { AccountDetailAssetSerializerResponse } from "../../api/index"
import type Decimal from "decimal.js"

export type AssetWithAccountBalance = AccountDetailAssetSerializerResponse

export type AssetBalances = AssetWithAccountBalance[]

export type AccountBalance = {
    algoBalance: Decimal
    fiatBalance: Decimal
    assetBalances: AssetBalances
    isPending: boolean,
    isFetched: boolean,
    isRefetching: boolean,
    isError: boolean,
}

export type AccountBalances = Map<string, AccountBalance>
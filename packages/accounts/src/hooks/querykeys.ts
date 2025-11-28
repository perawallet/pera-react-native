import { HistoryPeriod, Network } from "@perawallet/wallet-core-shared"
import { AccountAddress } from "../models"

const MODULE_PREFIX = 'accounts'

export const getAccountBalancesQueryKey = (
    address: string,
    network: Network,
) => {
    return [MODULE_PREFIX, 'balance', { address, network }]
}

export const getAccountBalancesHistoryQueryKey = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
    network: Network,
) => [MODULE_PREFIX, 'balance-history', { period, addresses, network }]

export const getAccountAssetBalanceHistoryQueryKey = (
    network: Network,
    account_address: string,
    asset_id: string,
    period: HistoryPeriod,
    currency: string,
) => [
        MODULE_PREFIX,
        'assets',
        'balance-history',
        { period, currency, network, asset_id, account_address },
    ]

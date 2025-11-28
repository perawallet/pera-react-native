import { Network } from "packages/shared/src";

export const MODULE_PREFIX = 'currencies'

export const getCurrenciesQueryKey = (network: Network) => [
    MODULE_PREFIX,
    { network },
]

export const getPreferredCurrencyPriceQueryKey = (
    network: Network,
    preferredCurrency: string,
) => [
        MODULE_PREFIX,
        { network, preferredCurrency },
    ]
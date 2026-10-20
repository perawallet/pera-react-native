/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Decimal } from 'decimal.js'
import {
    type AssetDisplayHint,
    type AssetRef,
    type LocalizedText,
    type TransactionSummary,
    type I18nKey,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    formatNumber,
    toBigInt,
} from '@perawallet/wallet-core-shared'
import {
    getDebitedAddress,
    isOutgoingFor,
    transactionStatusNotice,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { classifyDisplayableTransaction } from '../blockchain/utils/transactions'
import { algorandDescriptor } from '../descriptor'
import { resolveAlgorandAssetFacts } from './history/assetFacts'
import {
    algorandHistoryDataOf,
    type AlgorandHistoryData,
    type AlgorandSwapGroupDetail,
} from './history-data'
import { mapHistoryItemToDisplayableTransaction } from './mapHistoryItemToDisplayableTransaction'
import {
    APP_CALL_TITLE_KEY,
    ASSET_CONFIG_TITLE_KEY,
    ASSET_FREEZE_TITLE_KEY,
    DEFAULT_TITLE_KEY,
    KEY_REGISTRATION_TITLE_KEY,
    OPT_IN_TITLE_KEY,
    OPT_OUT_TITLE_KEY,
    SEND_TITLE_KEY,
    assetRefOf,
} from './summaryKeys'
import type { PeraDisplayableTransaction } from '../blockchain/models/algosdk-shapes'

const RECEIVE = i18nKey('transactions.list_item.receive')
const SWAP = i18nKey('transactions.list_item.swap')
const HEARTBEAT = i18nKey('transactions.list_item.heartbeat')
const STATE_PROOF = i18nKey('transactions.list_item.state_proof')
const INTERPRETED_TITLE = i18nKey('transactions.list_item.interpreted_title')
const SWAP_SUBTITLE = i18nKey('transactions.list_item.swap_subtitle')
const INNER_TRANSACTION_COUNT = i18nKey(
    'transactions.list_item.inner_transaction_count',
)

/** Trailing zeros below this are trimmed, so whole amounts stay short. */
const MIN_FRACTION_DIGITS = 2

// Decimals come straight from a backend that substitutes placeholder facts
// when its enrichment fails; `pow(10, NaN)` throws and a negative inflates.
const safeDecimals = (decimals: number): number =>
    isNaN(decimals) ? 0 : Math.max(0, Math.min(19, decimals))

// A swap leg can be worth a fraction of a cent, which a flat 2-digit format
// renders as a bare `0.00`; show up to the asset's own precision, trimmed to 2.
const formatAmount = (baseUnits: Decimal, decimals: number): string => {
    const precision = safeDecimals(decimals)
    const { sign, integer, fraction } = formatNumber(
        baseUnitsToDisplayUnits(baseUnits, precision),
        precision,
        undefined,
        MIN_FRACTION_DIGITS,
    )
    return `${sign}${integer}${fraction}`
}

/**
 * Net amount the account moved in a pay/axfer row. `amount` pays the
 * receiver; a close-out additionally sweeps `closeAmount` to `closeTo`. The
 * sender pays both legs; the close target only receives the legs addressed to
 * it. Any other account keeps the paid amount, which also covers rows where
 * the account matches no role (e.g. mid account switch).
 */
const netTransferAmount = (
    item: TransactionHistoryItem,
    data: AlgorandHistoryData,
    address: string,
    isOut: boolean,
): Decimal => {
    const paid = item.amount ?? new Decimal(0)
    const closed = data.closeAmount ?? new Decimal(0)
    if (isOut) return paid.add(closed)
    if (data.closeTo && data.closeTo === address) {
        return item.receiver === address ? paid.add(closed) : closed
    }
    return paid
}

const text = (key: I18nKey, params?: Record<string, string>): LocalizedText =>
    params ? { key, params } : { key }

const displayOf = (
    assetId: string,
    facts: { unitName: string; decimals: number },
): AssetDisplayHint => {
    const { unitName, decimals } = resolveAlgorandAssetFacts(assetId, facts)
    return { symbol: unitName, decimals }
}

const NATIVE_DISPLAY: AssetDisplayHint = {
    symbol: algorandDescriptor.nativeAsset.symbol,
    decimals: algorandDescriptor.nativeAsset.decimals,
}

const swapSummary = (swap: AlgorandSwapGroupDetail): TransactionSummary => {
    const assetIn = resolveAlgorandAssetFacts(swap.assetInId, {
        unitName: swap.assetInUnitName,
        decimals: swap.assetInDecimals,
    })
    const assetOut = resolveAlgorandAssetFacts(swap.assetOutId, {
        unitName: swap.assetOutUnitName,
        decimals: swap.assetOutDecimals,
    })
    return {
        kind: 'swap',
        title: text(SWAP),
        icon: 'swap',
        direction: 'in',
        subtitle: text(SWAP_SUBTITLE, {
            amountIn: formatAmount(swap.amountIn, assetIn.decimals),
            assetIn: assetIn.unitName,
            amountOut: formatAmount(swap.amountOut, assetOut.decimals),
            assetOut: assetOut.unitName,
        }),
        ...(swap.assetOutId === null
            ? {}
            : {
                  amount: {
                      assetRef: assetRefOf(swap.assetOutId),
                      value: swap.amountOut,
                      display: {
                          symbol: assetOut.unitName,
                          decimals: assetOut.decimals,
                      },
                  },
              }),
    }
}

const classify = (item: TransactionHistoryItem) => {
    const displayable: PeraDisplayableTransaction =
        mapHistoryItemToDisplayableTransaction(item) ?? {
            id: item.id,
            txType: item.txType,
            sender: item.sender,
            fee: toBigInt(item.fee),
            firstValid: 0n,
            lastValid: 0n,
        }
    return classifyDisplayableTransaction(displayable)
}

/**
 * The list row for a stored history item, read from `address`'s side. Pure and
 * synchronous; name resolution for the counterparty stays in the UI.
 */
export const summarizeAlgorandHistoryItem = (
    item: TransactionHistoryItem,
    address: string,
): TransactionSummary => {
    const data = algorandHistoryDataOf(item)
    const summary = data.swapGroupDetail
        ? swapSummary(data.swapGroupDetail)
        : classifiedSummary(item, data, address)
    const interpretedTitle = item.interpretedMeaning?.title
    const notice = transactionStatusNotice(
        item.status,
        item.roundTime > 0 ? item.roundTime * 1000 : undefined,
    )
    return {
        ...summary,
        ...(interpretedTitle
            ? { title: text(INTERPRETED_TITLE, { title: interpretedTitle }) }
            : {}),
        ...(notice && { notice }),
    }
}

const classifiedSummary = (
    item: TransactionHistoryItem,
    data: AlgorandHistoryData,
    address: string,
): TransactionSummary => {
    const isOut = isOutgoingFor(item, address)
    const counterparty =
        (isOut ? item.receiver : getDebitedAddress(item)) ?? undefined
    const hasAmount = item.amount !== null || data.closeAmount !== null
    const amountOn = (
        assetRef: AssetRef,
        display: AssetDisplayHint,
    ): Pick<TransactionSummary, 'amount'> =>
        hasAmount
            ? {
                  amount: {
                      assetRef,
                      value: netTransferAmount(item, data, address, isOut),
                      display,
                  },
              }
            : {}
    const assetAmount = item.asset
        ? amountOn(
              assetRefOf(item.asset.assetId),
              displayOf(item.asset.assetId, item.asset),
          )
        : {}
    const sendOrReceive = {
        title: text(isOut ? SEND_TITLE_KEY : RECEIVE),
        icon: isOut ? 'send' : 'receive',
        direction: isOut ? 'out' : 'in',
        counterparty,
    } as const
    const chainSpecific = (
        key: I18nKey,
        icon: TransactionSummary['icon'],
    ): TransactionSummary => ({
        kind: 'chain-specific',
        title: text(key),
        icon,
        direction: 'none',
    })

    switch (classify(item)) {
        case 'payment': {
            return {
                kind: 'transfer',
                ...sendOrReceive,
                ...amountOn(algorandDescriptor.nativeAsset.ref, NATIVE_DISPLAY),
            }
        }
        case 'asset-transfer':
        case 'asset-clawback': {
            return { kind: 'token-transfer', ...sendOrReceive, ...assetAmount }
        }
        case 'asset-opt-in': {
            return {
                ...chainSpecific(OPT_IN_TITLE_KEY, 'opt-in'),
                counterparty,
                ...assetAmount,
            }
        }
        case 'asset-opt-out': {
            return {
                ...chainSpecific(OPT_OUT_TITLE_KEY, 'opt-out'),
                direction: isOut ? 'out' : 'in',
                counterparty,
                ...assetAmount,
            }
        }
        case 'asset-config': {
            return chainSpecific(ASSET_CONFIG_TITLE_KEY, 'asset-config')
        }
        case 'asset-freeze': {
            return chainSpecific(ASSET_FREEZE_TITLE_KEY, 'asset-freeze')
        }
        case 'key-registration': {
            return chainSpecific(KEY_REGISTRATION_TITLE_KEY, 'consensus')
        }
        case 'heartbeat': {
            return chainSpecific(HEARTBEAT, 'consensus')
        }
        case 'app-call': {
            return {
                kind: 'contract-call',
                title: text(APP_CALL_TITLE_KEY),
                icon: 'contract-call',
                direction: 'none',
                balanceChanges: item.balanceImpacts.map(impact => ({
                    assetRef: assetRefOf(impact.assetId),
                    value: impact.amount,
                    display: displayOf(impact.assetId, {
                        unitName: impact.unitName,
                        decimals: impact.fractionDecimals,
                    }),
                })),
                ...((data.innerTransactionCount ?? 0) > 0 && {
                    subtitle: text(INNER_TRANSACTION_COUNT, {
                        innerCount: String(data.innerTransactionCount),
                    }),
                }),
            }
        }
        case 'state-proof': {
            return chainSpecific(STATE_PROOF, 'unknown')
        }
        default: {
            return chainSpecific(DEFAULT_TITLE_KEY, 'unknown')
        }
    }
}

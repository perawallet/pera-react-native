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
import type {
    AssetRef,
    LocalizedText,
    PeraDisplayableTransaction,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    formatNumber,
    toBigInt,
} from '@perawallet/wallet-core-shared'
import {
    getDebitedAddress,
    isOutgoingFor,
    type TransactionHistoryItem,
    type TransactionSwapGroupDetail,
} from '@perawallet/wallet-core-transactions'
import { classifyDisplayableTransaction } from '../blockchain/utils/transactions'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor } from '../descriptor'
import { resolveAlgorandAssetFacts } from './history/assetFacts'
import { mapHistoryItemToDisplayableTransaction } from './mapHistoryItemToDisplayableTransaction'

const SEND = 'transactions.list_item.send'
const RECEIVE = 'transactions.list_item.receive'
const SWAP = 'transactions.list_item.swap'
const OPT_IN = 'transactions.list_item.opt_in'
const OPT_OUT = 'transactions.list_item.opt_out'
const ASSET_CONFIG = 'transactions.list_item.asset_config'
const ASSET_FREEZE = 'transactions.list_item.asset_freeze'
const APP_CALL = 'transactions.list_item.app_call'
const KEY_REGISTRATION = 'transactions.list_item.key_registration'
const HEARTBEAT = 'transactions.list_item.heartbeat'
const STATE_PROOF = 'transactions.list_item.state_proof'
const DEFAULT = 'transactions.list_item.default'
const INTERPRETED_TITLE = 'transactions.list_item.interpreted_title'
const SWAP_SUBTITLE = 'transactions.list_item.swap_subtitle'
const INNER_TRANSACTION_COUNT = 'transactions.list_item.inner_transaction_count'

/** Every i18n key a history summary can carry. */
export const ALGORAND_HISTORY_SUMMARY_KEYS = [
    SEND,
    RECEIVE,
    SWAP,
    OPT_IN,
    OPT_OUT,
    ASSET_CONFIG,
    ASSET_FREEZE,
    APP_CALL,
    KEY_REGISTRATION,
    HEARTBEAT,
    STATE_PROOF,
    DEFAULT,
    INTERPRETED_TITLE,
    SWAP_SUBTITLE,
    INNER_TRANSACTION_COUNT,
] as const

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
    address: string,
    isOut: boolean,
): Decimal => {
    const paid = item.amount ?? new Decimal(0)
    const closed = item.closeAmount ?? new Decimal(0)
    if (isOut) return paid.add(closed)
    if (item.closeTo && item.closeTo === address) {
        return item.receiver === address ? paid.add(closed) : closed
    }
    return paid
}

const text = (key: string, params?: Record<string, string>): LocalizedText =>
    params ? { key, params } : { key }

const assetRefOf = (assetId: string): AssetRef => ({
    chainId: ALGORAND_CHAIN_ID,
    assetId,
})

const swapSummary = (swap: TransactionSwapGroupDetail): TransactionSummary => {
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
    const summary = item.swapGroupDetail
        ? swapSummary(item.swapGroupDetail)
        : classifiedSummary(item, address)
    const interpretedTitle = item.interpretedMeaning?.title
    return interpretedTitle
        ? {
              ...summary,
              title: text(INTERPRETED_TITLE, { title: interpretedTitle }),
          }
        : summary
}

const classifiedSummary = (
    item: TransactionHistoryItem,
    address: string,
): TransactionSummary => {
    const isOut = isOutgoingFor(item, address)
    const counterparty =
        (isOut ? item.receiver : getDebitedAddress(item)) ?? undefined
    const hasAmount = item.amount !== null || item.closeAmount !== null
    const amountOn = (
        assetRef: AssetRef,
    ): Pick<TransactionSummary, 'amount'> =>
        hasAmount
            ? {
                  amount: {
                      assetRef,
                      value: netTransferAmount(item, address, isOut),
                  },
              }
            : {}
    const assetAmount = item.asset
        ? amountOn(assetRefOf(item.asset.assetId))
        : {}
    const sendOrReceive = {
        title: text(isOut ? SEND : RECEIVE),
        icon: isOut ? 'send' : 'receive',
        direction: isOut ? 'out' : 'in',
        counterparty,
    } as const
    const chainSpecific = (
        key: string,
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
                ...amountOn(algorandDescriptor.nativeAsset.ref),
            }
        }
        case 'asset-transfer':
        case 'asset-clawback': {
            return { kind: 'token-transfer', ...sendOrReceive, ...assetAmount }
        }
        case 'asset-opt-in': {
            return {
                ...chainSpecific(OPT_IN, 'opt-in'),
                counterparty,
                ...assetAmount,
            }
        }
        case 'asset-opt-out': {
            return {
                ...chainSpecific(OPT_OUT, 'opt-out'),
                direction: isOut ? 'out' : 'in',
                counterparty,
                ...assetAmount,
            }
        }
        case 'asset-config': {
            return chainSpecific(ASSET_CONFIG, 'asset-config')
        }
        case 'asset-freeze': {
            return chainSpecific(ASSET_FREEZE, 'asset-freeze')
        }
        case 'key-registration': {
            return chainSpecific(KEY_REGISTRATION, 'consensus')
        }
        case 'heartbeat': {
            return chainSpecific(HEARTBEAT, 'consensus')
        }
        case 'app-call': {
            return {
                kind: 'contract-call',
                title: text(APP_CALL),
                icon: 'contract-call',
                direction: 'none',
                balanceChanges: item.balanceImpacts.map(impact => ({
                    assetRef: assetRefOf(impact.assetId),
                    value: impact.amount,
                })),
                ...((item.innerTransactionCount ?? 0) > 0 && {
                    subtitle: text(INNER_TRANSACTION_COUNT, {
                        innerCount: String(item.innerTransactionCount),
                    }),
                }),
            }
        }
        case 'state-proof': {
            return chainSpecific(STATE_PROOF, 'unknown')
        }
        default: {
            return chainSpecific(DEFAULT, 'unknown')
        }
    }
}

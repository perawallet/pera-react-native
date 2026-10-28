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
    addressCodecs,
    type AddressCodec,
    type AssetRef,
    type ChainScope,
    type PageRef,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { historyChainAdapters } from '../history-adapter'
import type {
    FetchTrustedCounterpartiesParams,
    TransferValuation,
    TrustedCounterparty,
} from './models'
import { valueTransfers } from './transfer-valuation'

export const MAX_COUNTERPARTY_HISTORY_PAGES = 12

// Paging stops once this many transfers prove trust. Untrusted rows never
// count, so a poisoner's spam can't push real payees out of the window; only
// more than MAX_COUNTERPARTY_HISTORY_PAGES pages of it can.
export const MIN_TRUSTED_TRANSFERS = 10

// A poisoner seeds history with zero-value, dust or fake-token transfers; any
// real payment between two parties is worth more than this.
export const MIN_TRUSTED_TRANSFER_USD = new Decimal('0.10')

const TRANSFER_KINDS: ReadonlySet<TransactionSummary['kind']> = new Set([
    'transfer',
    'token-transfer',
])

type CounterpartyTransfer = {
    counterparty: string
    assetRef: AssetRef
    /** Base units. */
    value: Decimal
    decimalsHint: Optional<number>
    isSentByAccount: boolean
}

// A send the account signed needs no minimum value, but the asset must still
// be real: signing an attacker's token call can emit a transfer to a look-alike.
export const isTrustedTransfer = ({
    value,
    decimals,
    usdPrice,
    isNative,
    isVerified,
    isSuspicious,
    isSignedByAccount,
}: TransferValuation): boolean => {
    if (value.isZero() || isSuspicious) return false
    if (isSignedByAccount) {
        return isNative || isVerified || usdPrice !== undefined
    }
    if (decimals === undefined || usdPrice === undefined) return false
    return baseUnitsToDisplayUnits(value, decimals)
        .mul(usdPrice)
        .gte(MIN_TRUSTED_TRANSFER_USD)
}

// Direction alone is not proof of a send: an EVM token contract can emit a
// transfer "from" the account that the account never signed.
const toCounterpartyTransfer = (
    record: TransactionRecord,
    accountAddress: string,
    codec: AddressCodec,
): CounterpartyTransfer[] => {
    const { summary } = record
    if (record.status !== 'confirmed') return []
    if (!TRANSFER_KINDS.has(summary.kind)) return []
    if (summary.direction !== 'in' && summary.direction !== 'out') return []
    if (!summary.counterparty || !summary.amount) return []
    if (!summary.amount.value.gt(0)) return []
    return [
        {
            counterparty: summary.counterparty,
            assetRef: summary.amount.assetRef,
            value: summary.amount.value,
            decimalsHint: summary.amount.display?.decimals,
            isSentByAccount:
                summary.direction === 'out' &&
                record.initiator !== undefined &&
                codec.areEqual(record.initiator, accountAddress),
        },
    ]
}

const trustedOf = async (
    transfers: CounterpartyTransfer[],
    scope: ChainScope,
): Promise<TrustedCounterparty[]> => {
    const valuations = await valueTransfers(
        transfers.map(transfer => ({
            assetRef: transfer.assetRef,
            value: transfer.value,
            decimalsHint: transfer.decimalsHint,
            isSignedByAccount: transfer.isSentByAccount,
        })),
        scope,
    )
    return transfers.flatMap((transfer, index) => {
        const valuation = valuations[index]
        return valuation && isTrustedTransfer(valuation)
            ? [
                  {
                      address: transfer.counterparty,
                      hasBeenPaid: transfer.isSentByAccount,
                  },
              ]
            : []
    })
}

const mergeInto = (
    known: TrustedCounterparty[],
    found: TrustedCounterparty[],
    codec: AddressCodec,
): void => {
    for (const counterparty of found) {
        const existing = known.find(entry =>
            codec.areEqual(entry.address, counterparty.address),
        )
        if (existing) {
            existing.hasBeenPaid ||= counterparty.hasBeenPaid
        } else {
            known.push({ ...counterparty })
        }
    }
}

export const fetchTrustedCounterparties = async ({
    accountAddress,
    scope,
    signal,
}: FetchTrustedCounterpartiesParams): Promise<TrustedCounterparty[]> => {
    if (!historyChainAdapters.has(scope.chainId)) return []
    const adapter = historyChainAdapters.get(scope.chainId)
    const codec = addressCodecs.get(scope.chainId)

    const known: TrustedCounterparty[] = []
    let trustedTransfers = 0
    let page: Optional<PageRef>
    for (let read = 0; read < MAX_COUNTERPARTY_HISTORY_PAGES; read++) {
        signal?.throwIfAborted()
        const result = await adapter.getTransactionHistory(
            accountAddress,
            scope,
            page,
        )
        const transfers = result.items.flatMap(record =>
            toCounterpartyTransfer(record, accountAddress, codec),
        )
        const trusted =
            transfers.length > 0 ? await trustedOf(transfers, scope) : []
        trustedTransfers += trusted.length
        mergeInto(known, trusted, codec)
        if (!result.next || trustedTransfers >= MIN_TRUSTED_TRANSFERS) break
        page = result.next
    }
    return known
}

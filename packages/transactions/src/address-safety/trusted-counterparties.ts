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
    isNativeAsset,
    type AddressCodec,
    type AssetRef,
    type ChainScope,
    type PageRef,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    assetsAdapterFor,
    fetchAndPersistPrices,
    getAssetPricesByIds,
    getAssetsByIds,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { historyChainAdapters } from '../history-adapter'
import type {
    FetchTrustedCounterpartiesParams,
    TransferValuation,
    TrustedCounterparty,
} from './models'

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

// Best effort: an asset whose metadata or price can't be had stays worthless.
const readAssets = async (
    refs: AssetRef[],
    scope: ChainScope,
): Promise<Map<string, PeraAsset>> => {
    const assetIds = refs.map(ref => ref.assetId)
    let assets = await getAssetsByIds({ assetIds, scope })
    const missing = refs.filter(
        ref => !assets.some(asset => asset.assetId === ref.assetId),
    )
    if (missing.length > 0) {
        try {
            await assetsAdapterFor(scope).syncAssets(missing, scope)
            assets = await getAssetsByIds({ assetIds, scope })
        } catch (error) {
            logger.warn('Could not sync counterparty transfer assets', {
                error,
            })
        }
    }
    return new Map(assets.map(asset => [asset.assetId, asset]))
}

const readPrices = async (
    assetIds: string[],
    scope: ChainScope,
): Promise<Map<string, Decimal>> => {
    let prices = await getAssetPricesByIds({ assetIds, scope })
    const missing = assetIds.filter(
        id => !prices.some(price => price.assetId === id),
    )
    if (missing.length > 0) {
        try {
            await fetchAndPersistPrices(missing, scope)
            prices = await getAssetPricesByIds({ assetIds, scope })
        } catch (error) {
            logger.warn('Could not price counterparty transfer assets', {
                error,
            })
        }
    }
    return new Map(prices.map(price => [price.assetId, price.usdPrice]))
}

const trustedOf = async (
    transfers: CounterpartyTransfer[],
    scope: ChainScope,
): Promise<TrustedCounterparty[]> => {
    const descriptor = getChainDescriptor(scope.chainId)
    const isNative = (transfer: CounterpartyTransfer) =>
        isNativeAsset(transfer.assetRef, descriptor)
    // A signed native send needs no lookups, so a history of plain payments
    // costs no asset or price requests.
    const needsLookup = transfers.filter(
        transfer => !(transfer.isSentByAccount && isNative(transfer)),
    )
    const refs = [
        ...new Map(
            needsLookup.map(({ assetRef }) => [assetRef.assetId, assetRef]),
        ).values(),
    ]
    const [assets, prices] =
        refs.length > 0
            ? await Promise.all([
                  readAssets(refs, scope),
                  readPrices(
                      refs.map(ref => ref.assetId),
                      scope,
                  ),
              ])
            : [new Map<string, PeraAsset>(), new Map<string, Decimal>()]

    return transfers.flatMap(transfer => {
        const { assetId } = transfer.assetRef
        const asset = assets.get(assetId)
        const tier = asset?.peraMetadata?.verificationTier
        const isTrusted = isTrustedTransfer({
            value: transfer.value,
            decimals: transfer.decimalsHint ?? asset?.decimals,
            usdPrice: prices.get(assetId),
            isNative: isNative(transfer),
            isVerified: tier === PeraAssetVerificationTier.verified,
            isSuspicious:
                !isNative(transfer) &&
                tier === PeraAssetVerificationTier.suspicious,
            isSignedByAccount: transfer.isSentByAccount,
        })
        return isTrusted
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

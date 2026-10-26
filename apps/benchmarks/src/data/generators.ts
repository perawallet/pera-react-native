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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { encodeAlgorandAddress } from './addresses'

// Every generator depends on its arguments alone, so a run on the same build
// reproduces the same data. Values only, no package imports: asset type and
// tier are plain literals so these load under Node for their tests.

/** Past the ids the native asset seed and the fixtures for other chains use. */
const FIRST_ASSET_ID = 10_000_000
const COLLECTIBLE_EVERY = 5
const CREATOR_INDEX = 900_000
const FIRST_ROUND_TIME = 1_700_000_000
const FIRST_ROUND = 30_000_000

/** A valid, checksummed address whose key bytes carry the index. */
export const algorandAddress = (index: number): string => {
    const key = new Uint8Array(32).fill(0x5a)
    new DataView(key.buffer).setUint32(0, index)
    return encodeAlgorandAddress(key)
}

export const evmAddress = (index: number): string =>
    `0x${'ab'.repeat(8)}${index.toString(16).padStart(24, '0')}`

export const benchAssets = (count: number, offset = 0): PeraAsset[] =>
    Array.from({ length: count }, (_, i): PeraAsset => {
        const n = offset + i
        const isCollectible = i % COLLECTIBLE_EVERY === COLLECTIBLE_EVERY - 1
        return {
            assetId: String(FIRST_ASSET_ID + n),
            decimals: isCollectible ? 0 : 6,
            creator: { address: algorandAddress(CREATOR_INDEX) },
            totalSupply: new Decimal(isCollectible ? 1 : 1_000_000_000),
            name: `Bench Asset ${n}`,
            unitName: `B${n}`,
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                type: isCollectible ? 'collectible' : 'standard_asset',
                ...(isCollectible && {
                    collectible: {
                        title: `Bench Collectible ${n}`,
                        collection: {
                            name: `Collection ${Math.floor(n / 50)}`,
                        },
                    },
                }),
            },
        }
    })

export const benchHoldings = (
    assets: readonly PeraAsset[],
): { assetId: string; amount: Decimal }[] =>
    assets.map((asset, i) => ({
        assetId: asset.assetId,
        amount: new Decimal(asset.decimals === 0 ? 1 : (i + 1) * 1000),
    }))

export const benchTransactions = (
    address: string,
    count: number,
): TransactionHistoryItem[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `BENCH-${address.slice(0, 8)}-${i}`,
        txType: 'pay',
        sender: i % 2 === 0 ? address : algorandAddress(CREATOR_INDEX),
        assetSender: null,
        receiver: i % 2 === 0 ? algorandAddress(CREATOR_INDEX) : address,
        confirmedRound: FIRST_ROUND - i,
        roundTime: FIRST_ROUND_TIME - i * 60,
        interpretedMeaning: null,
        fee: new Decimal(1000),
        amount: new Decimal((i + 1) * 1000),
        asset: null,
        balanceImpacts: [],
        chainData: {
            family: 'algorand',
            groupId: null,
            closeTo: null,
            closeAmount: null,
            applicationId: null,
            innerTransactionCount: null,
            swapGroupDetail: null,
        },
    }))

export const benchWatchAccounts = (
    count: number,
    chainIds: readonly string[],
): WalletAccount[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `bench-account-${i}`,
        name: `Bench ${i}`,
        custody: { kind: 'watch' as const },
        chains: Object.fromEntries(
            chainIds.map(chainId => [
                chainId,
                {
                    address:
                        chainId === 'algorand'
                            ? algorandAddress(i)
                            : evmAddress(i),
                    enabledAt: 0,
                },
            ]),
        ),
    }))

/**
 * What account `index` holds out of the asset universe: the heavy account
 * (index 0) holds all of it, the rest a rotating slice, so accounts share
 * assets the way real wallets do.
 */
export const assetsHeldBy = (
    index: number,
    assetsPerAccount: number,
    universe: readonly PeraAsset[],
): PeraAsset[] => {
    if (index === 0) return [...universe]
    const count = Math.min(assetsPerAccount, universe.length)
    const start = (index * assetsPerAccount) % universe.length
    return Array.from(
        { length: count },
        (_, i) => universe[(start + i) % universe.length],
    )
}

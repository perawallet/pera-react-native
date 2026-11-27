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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useKeptTokensStore,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useStoredAssetsAcrossScopesQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    toScopeKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { SuspectedPoisoning } from '@perawallet/wallet-core-transactions'
import {
    TRANSACTION_ROW_TYPES,
    type TransactionListRow,
} from '../../../utils/transactionListRows'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useWithoutSuspiciousRows } from '../useWithoutSuspiciousRows'

const ME = '0xme'
const OTHER = '0xother'
const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const header = (key: string): TransactionListRow => ({
    kind: TRANSACTION_ROW_TYPES.header,
    key,
    title: key,
})

const send = (
    id: string,
    initiator: string,
    value: number,
): TransactionListRow => ({
    kind: TRANSACTION_ROW_TYPES.record,
    key: id,
    record: {
        id,
        scope: SCOPE,
        status: 'confirmed',
        initiator,
        chainData: { family: 'evm' },
        summary: {
            kind: 'token-transfer',
            title: { key: i18nKey('transactions.list_item.send') },
            icon: 'send',
            direction: 'out',
            amount: {
                assetRef: { chainId: 'ethereum', assetId: '0xusdc' },
                value: new Decimal(value),
                display: { symbol: 'USDC', decimals: 6 },
            },
        },
    } as TransactionRecord,
})

const receive = (
    id: string,
    initiator: Optional<string>,
    assetId: string,
    {
        isSignedElsewhere,
        kind = 'token-transfer',
    }: {
        isSignedElsewhere?: boolean
        kind?: TransactionRecord['summary']['kind']
    } = {},
): TransactionListRow => ({
    kind: TRANSACTION_ROW_TYPES.record,
    key: id,
    record: {
        id,
        scope: SCOPE,
        status: 'confirmed',
        initiator,
        isSignedElsewhere,
        chainData: { family: 'evm' },
        summary: {
            kind,
            title: { key: i18nKey('transactions.list_item.receive') },
            icon: 'receive',
            direction: 'in',
            amount: {
                assetRef: { chainId: 'ethereum', assetId },
                value: new Decimal(5),
                display: { symbol: 'TKN', decimals: 0 },
            },
        },
    } as TransactionRecord,
})

const storedToken = (assetId: string, verificationTier: string) =>
    ({
        assetId,
        name: 'Token',
        unitName: 'TKN',
        peraMetadata: { verificationTier },
    }) as unknown as PeraAsset

const ROWS: TransactionListRow[] = [
    header('2026-11-25'),
    send('own', ME, 5),
    send('poisoned', ME, 5),
    header('2026-11-24'),
    send('spoofed', OTHER, 0),
]
const POISONED = new Map([['poisoned', {} as SuspectedPoisoning]])

describe('useWithoutSuspiciousRows', () => {
    beforeEach(() => {
        vi.mocked(useSelectedAccount).mockReturnValue({
            chains: { ethereum: { address: ME } },
        } as unknown as ReturnType<typeof useSelectedAccount>)
        vi.mocked(useStoredAssetsAcrossScopesQuery).mockClear()
        useKeptTokensStore.getState().resetState()
    })

    describe('a token waiting in the inbox', () => {
        const rows = [
            header('2026-11-25'),
            receive('airdrop', OTHER, '0xnew'),
            receive('own-swap', ME, '0xnew'),
            receive('listed', OTHER, '0xverified'),
            receive('unknown', OTHER, '0xunstored'),
            receive('no-longer-held', OTHER, '0xsold'),
            receive('unsigned', undefined, '0xnew'),
            receive('log-only', undefined, '0xnew', {
                isSignedElsewhere: true,
            }),
            receive('unstored-nft', OTHER, '0xnft', { kind: 'nft-transfer' }),
        ]

        beforeEach(() => {
            vi.mocked(useStoredAssetsAcrossScopesQuery).mockReturnValue({
                assets: new Map([
                    [
                        toScopeKey(SCOPE),
                        new Map([
                            ['0xnew', storedToken('0xnew', 'unverified')],
                            [
                                '0xverified',
                                storedToken('0xverified', 'verified'),
                            ],
                        ]),
                    ],
                ]),
                unstoredTiers: new Map([
                    [toScopeKey(SCOPE), new Map([['0xsold', 'verified']])],
                ]),
                readIds: new Map([
                    [
                        toScopeKey(SCOPE),
                        new Set([
                            '0xnew',
                            '0xverified',
                            '0xunstored',
                            '0xsold',
                            '0xnft',
                        ]),
                    ],
                ]),
            })
        })

        const keysOf = () =>
            renderHook(() =>
                useWithoutSuspiciousRows({
                    rows,
                    suspectedPoisoningById: new Map(),
                    isEnabled: true,
                }),
            ).result.current.map(row => row.key)

        it("drops someone else's transfer of it, log-only and unsynced ones included, and keeps the account's own, one with no named signer, an unsynced NFT and an unsynced token the backend verifies", () => {
            expect(keysOf()).toEqual([
                '2026-11-25',
                'own-swap',
                'listed',
                'no-longer-held',
                'unsigned',
                'unstored-nft',
            ])
        })

        it('keeps every transfer once the account accepts it', () => {
            useKeptTokensStore.getState().keepTokens({
                address: ME,
                scope: SCOPE,
                assetIds: ['0xnew'],
            })

            expect(keysOf()).toContain('airdrop')
        })

        it('keeps every row while its assets are still being read', () => {
            vi.mocked(useStoredAssetsAcrossScopesQuery).mockReturnValue({
                assets: new Map(),
                unstoredTiers: new Map(),
                readIds: new Map(),
            })

            expect(keysOf()).toEqual(rows.map(row => row.key))
        })
    })

    it('returns the rows as given, and reads no assets, while off', () => {
        const { result } = renderHook(() =>
            useWithoutSuspiciousRows({
                rows: ROWS,
                suspectedPoisoningById: POISONED,
                isEnabled: false,
            }),
        )

        expect(result.current).toBe(ROWS)
        expect(useStoredAssetsAcrossScopesQuery).toHaveBeenCalledWith([], {
            fetchMissingTiers: true,
        })
    })

    it('drops poisoned and spoofed entries, and a date header left with nothing under it', () => {
        const { result } = renderHook(() =>
            useWithoutSuspiciousRows({
                rows: ROWS,
                suspectedPoisoningById: POISONED,
                isEnabled: true,
            }),
        )

        expect(result.current.map(row => row.key)).toEqual([
            '2026-11-25',
            'own',
        ])
        expect(useStoredAssetsAcrossScopesQuery).toHaveBeenLastCalledWith(
            [{ scope: SCOPE, assetIds: ['0xusdc', '0xusdc', '0xusdc'] }],
            { fetchMissingTiers: true },
        )
    })

    it('keeps every row of an ordinary history', () => {
        const rows = [header('2026-11-25'), send('own', ME, 5)]

        const { result } = renderHook(() =>
            useWithoutSuspiciousRows({
                rows,
                suspectedPoisoningById: new Map(),
                isEnabled: true,
            }),
        )

        expect(result.current).toEqual(rows)
    })
})

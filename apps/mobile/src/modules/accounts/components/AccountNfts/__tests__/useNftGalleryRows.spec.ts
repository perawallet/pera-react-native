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

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { AccountCollectibleLiteRow } from '@perawallet/wallet-core-accounts'
import { useNftGalleryRows } from '../useNftGalleryRows'

const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
const BASE = { chainId: 'base', networkId: 'mainnet' } as const

const row = (
    assetId: string,
    overrides: Partial<AccountCollectibleLiteRow> = {},
): AccountCollectibleLiteRow =>
    ({
        assetId,
        amount: new Decimal(1),
        title: assetId,
        collectionName: null,
        verificationTier: 'unverified',
        isHidden: false,
        scope: ETHEREUM,
        ...overrides,
    }) as AccountCollectibleLiteRow

const rowsOf = (
    rows: AccountCollectibleLiteRow[],
    params: Partial<Parameters<typeof useNftGalleryRows>[0]> = {},
) =>
    renderHook(() =>
        useNftGalleryRows({
            rows,
            selectedChainId: null,
            showHidden: false,
            showSuspicious: false,
            sortMode: 'titleAsc',
            acquisitionOrder: new Map(),
            scope: ETHEREUM,
            ...params,
        }),
    ).result.current

describe('useNftGalleryRows', () => {
    it('narrows to the picked network, then drops hidden and suspicious rows', () => {
        const { collectibles } = rowsOf(
            [
                row('kept'),
                row('hidden', { isHidden: true }),
                row('spam', { verificationTier: 'suspicious' }),
                row('other-chain', { scope: BASE }),
            ],
            { selectedChainId: 'ethereum' },
        )

        expect(collectibles.map(r => r.assetId)).toEqual(['kept'])
    })

    it('says the user hid everything when only hidden rows are left', () => {
        const result = rowsOf([
            row('hidden', { isHidden: true }),
            row('hidden-spam', {
                isHidden: true,
                verificationTier: 'suspicious',
            }),
        ])

        expect(result.isUserHidden).toBe(true)
        expect(result.isSuspiciousHidden).toBe(false)
    })

    it('says the rest is suspicious once the hidden rows are set aside', () => {
        const result = rowsOf([
            row('hidden', { isHidden: true }),
            row('spam', { verificationTier: 'suspicious' }),
        ])

        expect(result.isUserHidden).toBe(false)
        expect(result.isSuspiciousHidden).toBe(true)
    })

    it('floats rows with no known order to the top for recentlyAdded', () => {
        const { collectibles } = rowsOf(
            [row('old'), row('new'), row('fresh')],
            {
                sortMode: 'recentlyAdded',
                acquisitionOrder: new Map([
                    ['old', 1],
                    ['new', 2],
                ]),
            },
        )

        expect(collectibles.map(r => r.assetId)).toEqual([
            'fresh',
            'new',
            'old',
        ])
    })
})

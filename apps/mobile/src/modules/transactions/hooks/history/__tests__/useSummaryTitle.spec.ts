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
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { useSummaryTitle } from '../useSummaryTitle'

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const TOKEN = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const t = vi.fn((key: string) => key)

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t }),
}))

const stored = (assets: { assetId: string; unitName: string }[]) =>
    vi.mocked(useAssetsQuery).mockReturnValue({
        data: new Map(assets.map(asset => [asset.assetId, asset])),
    } as unknown as ReturnType<typeof useAssetsQuery>)

const approval = (
    overrides: Partial<TransactionSummary> = {},
): TransactionSummary => ({
    kind: 'approval',
    title: {
        key: i18nKey('transactions.list_item.approve_asset'),
        params: { asset: '0xdAC1…1ec7' },
    },
    direction: 'none',
    icon: 'approval',
    subjectAsset: { chainId: 'ethereum', assetId: TOKEN },
    ...overrides,
})

describe('useSummaryTitle', () => {
    beforeEach(() => {
        t.mockClear()
        vi.mocked(useAssetsQuery).mockReset()
    })

    it('Given a subject asset the store knows, then the title names its unit', () => {
        stored([{ assetId: TOKEN, unitName: 'USDT' }])

        renderHook(() => useSummaryTitle(approval(), SCOPE))

        expect(useAssetsQuery).toHaveBeenCalledWith(SCOPE, [TOKEN])
        expect(t).toHaveBeenCalledWith('transactions.list_item.approve_asset', {
            asset: 'USDT',
        })
    })

    it('Given a subject asset the store lacks, then the title keeps the fallback param', () => {
        stored([])

        renderHook(() => useSummaryTitle(approval(), SCOPE))

        expect(t).toHaveBeenCalledWith('transactions.list_item.approve_asset', {
            asset: '0xdAC1…1ec7',
        })
    })

    it('Given no subject asset, then the title renders as given and nothing is looked up', () => {
        stored([])
        const summary = approval({ subjectAsset: undefined })

        renderHook(() => useSummaryTitle(summary, SCOPE))

        expect(useAssetsQuery).toHaveBeenCalledWith(SCOPE, [])
        expect(t).toHaveBeenCalledWith('transactions.list_item.approve_asset', {
            asset: '0xdAC1…1ec7',
        })
    })
})

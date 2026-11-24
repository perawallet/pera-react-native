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
import { act, renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    keptAssetIdsOf,
    useKeptTokensStore,
    type AccountHoldingsLiteRow,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAutoHiddenTokensScreen } from '../useAutoHiddenTokensScreen'

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ETH_ADDRESS = `0x${'a'.repeat(40)}`

const mocks = vi.hoisted(() => ({
    holdings: [] as unknown[],
    showToast: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useSelectedAccount: () => account,
    assetFromHoldingLiteRow: () => ({ name: 'Spam' }),
}))

vi.mock('../../../hooks/useAutoHiddenHoldings', () => ({
    useAutoHiddenHoldings: () => ({
        holdings: mocks.holdings,
        isPending: false,
        showsNetwork: false,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({ showToast: mocks.showToast })),
}))

const account = {
    id: 'eth',
    name: '',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ETH_ADDRESS } },
} as WalletAccount

const row = {
    scope: ETHEREUM,
    assetId: '0xspam',
    amount: new Decimal(1),
} as AccountHoldingsLiteRow

describe('useAutoHiddenTokensScreen', () => {
    beforeEach(() => {
        mocks.holdings = [row]
        mocks.showToast.mockClear()
        useKeptTokensStore.getState().resetState()
    })

    it('lists the tokens the asset list hides as suspicious', () => {
        const { result } = renderHook(() => useAutoHiddenTokensScreen())

        expect(result.current.rows).toEqual([row])
    })

    it('keeps an unhidden token listed for good', () => {
        const { result } = renderHook(() => useAutoHiddenTokensScreen())

        act(() => result.current.handleUnhide(row))

        expect(
            keptAssetIdsOf(
                useKeptTokensStore.getState().keptTokens,
                ETH_ADDRESS,
                ETHEREUM,
            ),
        ).toEqual(['0xspam'])
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'success',
                title: 'token_visibility.shown_toast_title',
            }),
        )
    })
})

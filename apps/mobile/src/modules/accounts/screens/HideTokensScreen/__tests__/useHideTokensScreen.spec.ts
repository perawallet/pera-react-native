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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    hiddenAssetIdsOf,
    useHiddenTokensStore,
    type AccountHoldingsLiteRow,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useHideTokensScreen } from '../useHideTokensScreen'

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETH_ADDRESS = `0x${'a'.repeat(40)}`

const mocks = vi.hoisted(() => ({
    account: null as WalletAccount | null,
    sources: [] as { address: string; scope: ChainScope }[],
    holdings: [] as unknown[],
    // What the asset list would read: the holdings the suspicious filter keeps.
    listed: undefined as unknown[] | undefined,
    isPending: false,
    showSuspicious: false,
    queryOptions: [] as unknown[],
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useSelectedAccount: () => mocks.account,
    useAccountHoldingSources: () => mocks.sources,
    useAccountAssetsQuery: (
        _sources: unknown,
        options: { filters?: { hideSuspicious?: boolean } },
    ) => {
        mocks.queryOptions.push(options)
        const isListRead = options.filters?.hideSuspicious === true
        return {
            holdings: isListRead
                ? (mocks.listed ?? mocks.holdings)
                : mocks.holdings,
            isPending: mocks.isPending,
        }
    },
}))

const account: WalletAccount = {
    id: 'two-chains',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: 'ALGO_ADDRESS' },
        ethereum: { address: ETH_ADDRESS },
    },
}

const holding = (
    assetId: string,
    scope: ChainScope = ETHEREUM,
): AccountHoldingsLiteRow =>
    ({ scope, assetId, amount: new Decimal(5) }) as AccountHoldingsLiteRow

const hiddenIds = () =>
    hiddenAssetIdsOf(
        useHiddenTokensStore.getState().hiddenTokens,
        ETH_ADDRESS,
        ETHEREUM,
    )

describe('useHideTokensScreen', () => {
    beforeEach(() => {
        registerEthereumChain()
        mocks.account = account
        mocks.sources = [
            { address: 'ALGO_ADDRESS', scope: ALGORAND },
            { address: ETH_ADDRESS, scope: ETHEREUM },
        ]
        mocks.holdings = [
            holding('0x1'),
            holding('0x2'),
            holding('native'),
            holding('31566704', ALGORAND),
        ]
        mocks.isPending = false
        mocks.listed = undefined
        mocks.showSuspicious = false
        mocks.queryOptions = []
        vi.mocked(useAssetPreferencesStore).mockImplementation(selector =>
            selector({
                showSuspicious: mocks.showSuspicious,
            } as ReturnType<typeof useAssetPreferencesStore.getState>),
        )
        useHiddenTokensStore.getState().resetState()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('lists the tokens that can be hidden under Tokens, leaving out the native coin and opt-in assets', () => {
        const { result } = renderHook(() => useHideTokensScreen())

        expect(result.current.items).toEqual([
            {
                kind: 'header',
                id: 'shown',
                title: 'hide_tokens.tokens_section',
            },
            { kind: 'token', row: mocks.holdings[0] },
            { kind: 'token', row: mocks.holdings[1] },
        ])
    })

    it('reads without NFTs, which the collectibles gallery never filters by hidden state', () => {
        renderHook(() => useHideTokensScreen())

        expect(mocks.queryOptions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ filters: { hideNfts: true } }),
            ]),
        )
    })

    describe('a token the suspicious filter keeps out', () => {
        beforeEach(() => {
            mocks.holdings = [holding('0x1'), holding('0xspam')]
            mocks.listed = [holding('0x1')]
        })

        it('is listed under Hidden Tokens, locked, while Show suspicious assets is off', () => {
            const { result } = renderHook(() => useHideTokensScreen())

            expect(result.current.items).toEqual([
                {
                    kind: 'header',
                    id: 'shown',
                    title: 'hide_tokens.tokens_section',
                },
                { kind: 'token', row: mocks.holdings[0] },
                {
                    kind: 'header',
                    id: 'hidden',
                    title: 'hide_tokens.hidden_section',
                },
                { kind: 'token', row: mocks.holdings[1] },
            ])
            expect(result.current.isRowLocked(holding('0xspam'))).toBe(true)
            expect(result.current.isRowLocked(holding('0x1'))).toBe(false)
        })

        it('ignores a toggle while locked, so Unhide never promises what the filter would undo', () => {
            const { result } = renderHook(() => useHideTokensScreen())

            act(() => result.current.handleToggleHidden(holding('0xspam')))

            expect(useHiddenTokensStore.getState().hiddenTokens).toEqual({})
        })

        it('is listed under Tokens, with a toggle, once the switch is on', () => {
            mocks.showSuspicious = true

            const { result } = renderHook(() => useHideTokensScreen())

            expect(result.current.items.map(item => item.kind)).toEqual([
                'header',
                'token',
                'token',
            ])
            expect(result.current.isRowLocked(holding('0xspam'))).toBe(false)
        })

        it('keeps a working Unhide for one the user also hid for good', () => {
            act(() =>
                useHiddenTokensStore.getState().setTokenHidden({
                    address: ETH_ADDRESS,
                    scope: ETHEREUM,
                    assetId: '0xspam',
                    isHidden: true,
                }),
            )
            const { result } = renderHook(() => useHideTokensScreen())

            expect(result.current.isRowLocked(holding('0xspam'))).toBe(false)
            act(() => result.current.handleToggleHidden(holding('0xspam')))

            expect(hiddenIds()).toEqual([])
        })

        it('does not read the list-filtered set while the switch is on', () => {
            mocks.showSuspicious = true
            mocks.listed = undefined

            renderHook(() => useHideTokensScreen())

            expect(mocks.queryOptions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ enabled: false }),
                ]),
            )
        })
    })

    it('moves a hidden token under Hidden Tokens', () => {
        const { result } = renderHook(() => useHideTokensScreen())

        act(() => result.current.handleToggleHidden(holding('0x1')))

        expect(hiddenIds()).toEqual(['0x1'])
        expect(result.current.items.map(item => item.kind)).toEqual([
            'header',
            'token',
            'header',
            'token',
        ])
        expect(result.current.items[2]).toEqual({
            kind: 'header',
            id: 'hidden',
            title: 'hide_tokens.hidden_section',
        })
        expect(result.current.isRowHidden(holding('0x1'))).toBe(true)
    })

    it('shows a hidden token again when toggled back', () => {
        const { result } = renderHook(() => useHideTokensScreen())
        act(() => result.current.handleToggleHidden(holding('0x1')))

        act(() => result.current.handleToggleHidden(holding('0x1')))

        expect(hiddenIds()).toEqual([])
        expect(result.current.items).toHaveLength(3)
    })

    it('omits a section header when the section is empty', () => {
        mocks.holdings = [holding('0x1')]
        const { result } = renderHook(() => useHideTokensScreen())
        act(() => result.current.handleToggleHidden(holding('0x1')))

        expect(result.current.items.map(item => item.kind)).toEqual([
            'header',
            'token',
        ])
        expect(result.current.items[0]).toMatchObject({ id: 'hidden' })
    })

    it('does not name the network on each row while one chain receives unasked assets', () => {
        const { result } = renderHook(() => useHideTokensScreen())

        expect(result.current.showsNetwork).toBe(false)
    })

    it('has nothing to list for an account on no such chain', () => {
        mocks.sources = [{ address: 'ALGO_ADDRESS', scope: ALGORAND }]
        mocks.holdings = []

        expect(
            renderHook(() => useHideTokensScreen()).result.current.items,
        ).toEqual([])
    })
})

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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'
import { useAutoHiddenTokensRow } from '../useAutoHiddenTokensRow'

const mocks = vi.hoisted(() => ({
    holdings: [] as unknown[],
    showSuspicious: false,
    navigate: vi.fn(),
}))

vi.mock('../../../hooks/useAutoHiddenHoldings', () => ({
    useAutoHiddenHoldings: () => ({
        holdings: mocks.holdings,
        isPending: false,
        showsNetwork: false,
    }),
}))

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<object>()),
    useNavigation: () => ({ navigate: mocks.navigate }),
}))

const account = { id: 'a' } as WalletAccount

describe('useAutoHiddenTokensRow', () => {
    beforeEach(() => {
        mocks.holdings = [{ assetId: '0x1' }, { assetId: '0x2' }]
        mocks.showSuspicious = false
        mocks.navigate.mockClear()
        vi.mocked(useAssetPreferencesStore).mockImplementation(selector =>
            selector({
                showSuspicious: mocks.showSuspicious,
            } as ReturnType<typeof useAssetPreferencesStore.getState>),
        )
    })

    it('counts the tokens the asset list hides as suspicious', () => {
        const { result } = renderHook(() => useAutoHiddenTokensRow(account))

        expect(result.current).toMatchObject({ count: 2, isVisible: true })
    })

    it('is not shown when nothing is hidden', () => {
        mocks.holdings = []

        const { result } = renderHook(() => useAutoHiddenTokensRow(account))

        expect(result.current.isVisible).toBe(false)
    })

    it('is not shown while the list shows suspicious assets', () => {
        mocks.showSuspicious = true

        const { result } = renderHook(() => useAutoHiddenTokensRow(account))

        expect(result.current.isVisible).toBe(false)
    })

    it('opens the hidden tokens screen', () => {
        const { result } = renderHook(() => useAutoHiddenTokensRow(account))

        act(() => result.current.handlePress())

        expect(mocks.navigate).toHaveBeenCalledWith('AutoHiddenTokens')
    })
})

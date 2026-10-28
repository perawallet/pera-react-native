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
import { useReceiveFundsRoutes } from '../useReceiveFundsRoutes'

const state = vi.hoisted(() => ({
    receive: { canSelectAccount: true, selectedAccount: undefined } as {
        canSelectAccount: boolean
        selectedAccount?: { id: string }
        chainId?: string
    },
    options: [] as { chainId: string; isEnabled: boolean }[],
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountChainOptionsResolver: () => () => state.options,
}))

vi.mock('@modules/transactions/hooks', async () => ({
    useReceiveFunds: () => state.receive,
    needsChainSelection: (
        await vi.importActual<
            typeof import('../../../hooks/chain-selection/needsChainSelection')
        >('../../../hooks/chain-selection/needsChainSelection')
    ).needsChainSelection,
}))

describe('useReceiveFundsRoutes', () => {
    beforeEach(() => {
        state.options = [{ chainId: 'algorand', isEnabled: true }]
    })

    it('starts at the account picker when the account is not fixed', () => {
        state.receive = { canSelectAccount: true }

        const { result } = renderHook(() => useReceiveFundsRoutes())

        expect(result.current.initialRouteName).toBe('AccountSelection')
    })

    it('starts at the chain picker for a fixed account with a chain to choose', () => {
        state.receive = {
            canSelectAccount: false,
            selectedAccount: { id: 'a' },
        }
        state.options = [
            { chainId: 'ethereum', isEnabled: true },
            { chainId: 'base', isEnabled: false },
        ]

        const { result } = renderHook(() => useReceiveFundsRoutes())

        expect(result.current.initialRouteName).toBe('ChainSelection')
    })

    it('opens the QR for a fixed account on a single chain', () => {
        state.receive = {
            canSelectAccount: false,
            selectedAccount: { id: 'a' },
        }

        const { result } = renderHook(() => useReceiveFundsRoutes())

        expect(result.current.initialRouteName).toBe('QRView')
    })

    it('opens the QR for a fixed account on the chain a caller pinned', () => {
        state.receive = {
            canSelectAccount: false,
            selectedAccount: { id: 'a' },
            chainId: 'ethereum',
        }
        state.options = [
            { chainId: 'ethereum', isEnabled: true },
            { chainId: 'base', isEnabled: false },
        ]

        const { result } = renderHook(() => useReceiveFundsRoutes())

        expect(result.current.initialRouteName).toBe('QRView')
    })
})

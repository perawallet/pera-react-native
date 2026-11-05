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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    useSwapSourceScope,
    useSwapsStore,
} from '@perawallet/wallet-core-swaps'
import { useSwapSourceChainRow } from '../useSwapSourceChainRow'

const mocks = vi.hoisted(() => ({
    rows: [] as { chainId: string; isEnabled: boolean }[],
    setSourceChainId: vi.fn(),
    selection: vi.fn(),
}))

vi.mock('@modules/transactions/chain-selection', () => ({
    useAccountChainSelection: (params: {
        onSelectChain: (chainId: string) => void
    }) => {
        mocks.selection(params)
        return { rows: mocks.rows, handleSelectChain: params.onSelectChain }
    },
}))

const ACCOUNT = { id: 'account-1' } as WalletAccount
const SECOND_CHAIN = { chainId: 'ethereum', networkId: 'mainnet' } as const
const row = (chainId: string, isEnabled = true) => ({ chainId, isEnabled })

describe('useSwapSourceChainRow', () => {
    beforeEach(() => {
        mocks.rows = []
        vi.mocked(useSwapSourceScope).mockReturnValue(SECOND_CHAIN)
        vi.mocked(useSwapsStore).mockImplementation(((
            selector: (state: unknown) => unknown,
        ) =>
            selector({
                setSourceChainId: mocks.setSourceChainId,
            })) as unknown as typeof useSwapsStore)
    })

    it('stays hidden for an account on one swap chain', () => {
        mocks.rows = [row('ethereum')]

        const { result } = renderHook(() => useSwapSourceChainRow(ACCOUNT))

        expect(result.current.isVisible).toBe(false)
    })

    it('counts only the chains the account already has', () => {
        mocks.rows = [row('ethereum'), row('base', false)]

        const { result } = renderHook(() => useSwapSourceChainRow(ACCOUNT))

        expect(result.current.isVisible).toBe(false)
        expect(result.current.rows).toEqual([row('ethereum')])
    })

    it('shows for an account on two, on the chain in use', () => {
        mocks.rows = [row('algorand'), row('ethereum')]

        const { result } = renderHook(() => useSwapSourceChainRow(ACCOUNT))

        expect(result.current).toMatchObject({
            isVisible: true,
            chainId: 'ethereum',
        })
    })

    it('asks for chains the account can sign and swap on', () => {
        renderHook(() => useSwapSourceChainRow(ACCOUNT))

        expect(mocks.selection).toHaveBeenCalledWith(
            expect.objectContaining({
                account: ACCOUNT,
                capability: 'swap',
                isSignerRequired: true,
            }),
        )
    })

    it('has no chain with no account that can swap', () => {
        vi.mocked(useSwapSourceScope).mockReturnValue(null)

        const { result } = renderHook(() => useSwapSourceChainRow(null))

        expect(result.current).toMatchObject({
            isVisible: false,
            chainId: null,
        })
    })

    it('stores a newly chosen chain', () => {
        const { result } = renderHook(() => useSwapSourceChainRow(ACCOUNT))

        act(() => result.current.handleSelectChain('algorand'))

        expect(mocks.setSourceChainId).toHaveBeenCalledWith('algorand')
    })

    it('keeps the pair when the same chain is picked again', () => {
        const { result } = renderHook(() => useSwapSourceChainRow(ACCOUNT))

        act(() => result.current.handleSelectChain('ethereum'))

        expect(mocks.setSourceChainId).not.toHaveBeenCalled()
    })
})

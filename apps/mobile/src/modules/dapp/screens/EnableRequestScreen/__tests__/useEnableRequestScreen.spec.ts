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

const mocks = vi.hoisted(() => ({
    approve: vi.fn(),
    reject: vi.fn(),
    useDappRequest: vi.fn(),
    useSigningAccounts: vi.fn(),
    useSelectedAccountAddress: vi.fn(),
}))

vi.mock('../../../hooks/useDappRequest', () => ({
    useDappRequest: mocks.useDappRequest,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: mocks.useSigningAccounts,
    useSelectedAccountAddress: mocks.useSelectedAccountAddress,
}))

import { useEnableRequestScreen } from '../useEnableRequestScreen'

const ACCOUNT_A = { address: 'AAAA', name: 'Account A' }
const ACCOUNT_B = { address: 'BBBB', name: 'Account B' }

describe('useEnableRequestScreen', () => {
    beforeEach(() => {
        mocks.approve.mockReset()
        mocks.reject.mockReset()
        mocks.useDappRequest.mockReturnValue({
            requestId: 'q1',
            approval: {
                requestId: 'q1',
                origin: 'https://x.com',
                faviconUrl: 'https://x.com/favicon.ico',
                kind: 'enable',
            },
            isLoading: false,
            approve: mocks.approve,
            reject: mocks.reject,
        })
        mocks.useSigningAccounts.mockReturnValue([ACCOUNT_A, ACCOUNT_B])
        mocks.useSelectedAccountAddress.mockReturnValue({
            selectedAccountAddress: ACCOUNT_A.address,
            setSelectedAccountAddress: vi.fn(),
        })
    })

    it('exposes origin, favicon and the signing account list from the pending approval', () => {
        const { result } = renderHook(() => useEnableRequestScreen())
        expect(result.current.origin).toBe('https://x.com')
        expect(result.current.faviconUrl).toBe('https://x.com/favicon.ico')
        expect(result.current.accounts).toEqual([ACCOUNT_A, ACCOUNT_B])
    })

    it('default-selects the active account', () => {
        const { result } = renderHook(() => useEnableRequestScreen())
        expect(result.current.selected.has(ACCOUNT_A.address)).toBe(true)
        expect(result.current.canConnect).toBe(true)
    })

    it('does not default-select an active account absent from the signing list', () => {
        mocks.useSelectedAccountAddress.mockReturnValue({
            selectedAccountAddress: 'WATCH_ONLY',
            setSelectedAccountAddress: vi.fn(),
        })
        const { result } = renderHook(() => useEnableRequestScreen())
        expect(result.current.selected.size).toBe(0)
        expect(result.current.canConnect).toBe(false)
    })

    it('toggle adds and removes an address from the selection', () => {
        const { result } = renderHook(() => useEnableRequestScreen())
        act(() => result.current.toggle(ACCOUNT_B.address))
        expect(result.current.selected.has(ACCOUNT_B.address)).toBe(true)
        act(() => result.current.toggle(ACCOUNT_A.address))
        expect(result.current.selected.has(ACCOUNT_A.address)).toBe(false)
    })

    it('handleConnect calls approve with the selected addresses', () => {
        const { result } = renderHook(() => useEnableRequestScreen())
        act(() => result.current.toggle(ACCOUNT_B.address))
        act(() => result.current.handleConnect())
        expect(mocks.approve).toHaveBeenCalledWith(
            expect.arrayContaining([ACCOUNT_A.address, ACCOUNT_B.address]),
        )
    })

    it('handleConnect does nothing when canConnect is false', () => {
        mocks.useSelectedAccountAddress.mockReturnValue({
            selectedAccountAddress: undefined,
            setSelectedAccountAddress: vi.fn(),
        })
        const { result } = renderHook(() => useEnableRequestScreen())
        act(() => result.current.handleConnect())
        expect(mocks.approve).not.toHaveBeenCalled()
    })

    it('handleCancel calls reject', () => {
        const { result } = renderHook(() => useEnableRequestScreen())
        act(() => result.current.handleCancel())
        expect(mocks.reject).toHaveBeenCalledTimes(1)
    })
})

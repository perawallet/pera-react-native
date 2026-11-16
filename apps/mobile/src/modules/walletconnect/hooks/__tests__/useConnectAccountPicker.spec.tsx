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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useConnectAccountPicker } from '../useConnectAccountPicker'

const { request, dismiss, showError } = vi.hoisted(() => ({
    request: vi.fn(),
    dismiss: vi.fn(),
    showError: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError }),
}))

vi.mock('@modules/bottom-sheet', async importOriginal => ({
    ...(await importOriginal<typeof import('@modules/bottom-sheet')>()),
    useBottomSheet: () => ({ request, dismiss }),
}))

const ACCOUNTS = [
    { id: 'a', chains: { ethereum: { address: '0xA' } } },
    { id: 'b', chains: { ethereum: { address: '0xB' } } },
] as unknown as WalletAccount[]

const ARGS = {
    accounts: ACCOUNTS,
    chainId: 'ethereum' as const,
    selectedAccountId: 'a',
    title: 'Select account',
}

describe('useConnectAccountPicker', () => {
    it('resolves the account id the picker sheet resolves', async () => {
        request.mockResolvedValueOnce('b')
        const { result } = renderHook(() => useConnectAccountPicker())

        await expect(result.current.pickAccount(ARGS)).resolves.toBe('b')
    })

    it('resolves null when the sheet is dismissed', async () => {
        request.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useConnectAccountPicker())

        await expect(result.current.pickAccount(ARGS)).resolves.toBeNull()
    })

    // The approval sheet can settle (expiry, answered elsewhere) under an open
    // picker, which would otherwise be left stacked over nothing.
    it('closes a still-open picker when its owner unmounts', async () => {
        request.mockReturnValueOnce(new Promise(() => {}))
        const { result, unmount } = renderHook(() => useConnectAccountPicker())

        void result.current.pickAccount(ARGS)
        await vi.waitFor(() => expect(request).toHaveBeenCalled())
        const [{ id }] = request.mock.lastCall as [{ id: string }]
        unmount()

        expect(id).toEqual(expect.any(String))
        expect(dismiss).toHaveBeenCalledWith(id)
    })

    it('opens nothing for an owner that unmounted while the picker loaded', async () => {
        request.mockClear()
        const { result, unmount } = renderHook(() => useConnectAccountPicker())

        const picking = result.current.pickAccount(ARGS)
        unmount()

        await expect(picking).resolves.toBeNull()
        expect(request).not.toHaveBeenCalled()
    })

    it('leaves nothing to close once the picker has answered', async () => {
        dismiss.mockClear()
        request.mockResolvedValueOnce('a')
        const { result, unmount } = renderHook(() => useConnectAccountPicker())

        await result.current.pickAccount(ARGS)
        unmount()

        expect(dismiss).not.toHaveBeenCalled()
    })

    it('opens one picker for a double tap, the second resolving null', async () => {
        request.mockClear()
        let settle: (id: string) => void = () => {}
        request.mockReturnValueOnce(
            new Promise<string>(resolve => {
                settle = resolve
            }),
        )
        const { result } = renderHook(() => useConnectAccountPicker())

        const first = result.current.pickAccount(ARGS)
        const second = result.current.pickAccount(ARGS)
        await vi.waitFor(() => expect(request).toHaveBeenCalled())
        settle('b')

        await expect(second).resolves.toBeNull()
        await expect(first).resolves.toBe('b')
        expect(request).toHaveBeenCalledTimes(1)
    })

    it('resolves null for an id that is not one of the offered accounts', async () => {
        request.mockResolvedValueOnce('elsewhere')
        const { result } = renderHook(() => useConnectAccountPicker())

        await expect(result.current.pickAccount(ARGS)).resolves.toBeNull()
    })
})

describe('useConnectAccountPicker when the picker cannot load', () => {
    it('tells the user and resolves null, opening nothing', async () => {
        vi.resetModules()
        const failure = new Error('chunk failed')
        vi.doMock('../../components/ConnectAccountPickerContent', () => {
            throw failure
        })
        const { useConnectAccountPicker: freshHook } =
            await import('../useConnectAccountPicker')
        request.mockClear()
        const { result } = renderHook(() => freshHook())

        await expect(result.current.pickAccount(ARGS)).resolves.toBeNull()

        expect(request).not.toHaveBeenCalled()
        expect(showError).toHaveBeenCalled()
        vi.doUnmock('../../components/ConnectAccountPickerContent')
    })
})

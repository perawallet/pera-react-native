/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    resolveImportAccountType,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'

const { mockNavigate, mockShowError } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockShowError: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    resolveImportAccountType: vi.fn(),
    setPendingImportMnemonic: vi.fn(),
}))

vi.mock('../../navigateToScreen', () => ({
    navigateToScreen: mockNavigate,
}))

vi.mock('../useDeeplinkErrorHandler', () => ({
    useDeeplinkErrorHandler: () => mockShowError,
}))

import { useRecoverAddressDeeplink } from '../useRecoverAddressDeeplink'

describe('useRecoverAddressDeeplink', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('ignores non-qr sources (guards against malicious pasted URLs)', async () => {
        const { result } = renderHook(() => useRecoverAddressDeeplink())

        await act(async () => {
            await result.current({
                mnemonic: 'word '.repeat(24).trim(),
                source: 'deeplink',
                replaceCurrentScreen: false,
            })
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('shows an error for an invalid mnemonic and does not navigate', async () => {
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: false,
        } as never)

        const { result } = renderHook(() => useRecoverAddressDeeplink())

        await act(async () => {
            await result.current({
                mnemonic: 'too short',
                source: 'qr',
                replaceCurrentScreen: false,
            })
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'recover' }),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('opens the pre-filled Import screen instead of importing silently', async () => {
        const mnemonic = new Array(24).fill('word').join(' ')
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: true,
            accountType: 'hdWallet',
        } as never)

        const { result } = renderHook(() => useRecoverAddressDeeplink())

        await act(async () => {
            await result.current({
                mnemonic,
                source: 'qr',
                replaceCurrentScreen: true,
            })
        })

        // Mnemonic goes through the in-memory store, not the route params.
        expect(setPendingImportMnemonic).toHaveBeenCalledWith(mnemonic)
        expect(mockNavigate).toHaveBeenCalledWith(true, 'AddAccount', {
            screen: 'ImportAccount',
            params: {
                accountType: 'hdWallet',
            },
        })
        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('normalizes a comma-separated mnemonic before forwarding it', async () => {
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: true,
            accountType: 'algo25',
        } as never)

        const { result } = renderHook(() => useRecoverAddressDeeplink())

        await act(async () => {
            await result.current({
                mnemonic: 'one,two,three',
                source: 'qr',
                replaceCurrentScreen: false,
            })
        })

        expect(setPendingImportMnemonic).toHaveBeenCalledWith('one two three')
        expect(mockNavigate).toHaveBeenCalledWith(false, 'AddAccount', {
            screen: 'ImportAccount',
            params: {
                accountType: 'algo25',
            },
        })
    })
})

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
import { renderHook, act } from '@testing-library/react'

import { useWatchAccountButtonPanel } from '../useWatchAccountButtonPanel'

const mocks = vi.hoisted(() => ({
    account: {
        id: 'watch-1',
        custody: { kind: 'watch' },
        chains: { algorand: { address: 'WATCH_ADDRESS' } },
    } as Record<string, unknown>,
    openReceiveFunds: vi.fn(),
    openAccountOptions: vi.fn(),
    copyToClipboard: vi.fn(),
    showToast: vi.fn(),
}))

vi.mock('../../AccountOverview/AccountOverviewModalContext', () => ({
    useAccountOverviewModal: () => ({
        account: mocks.account,
        openReceiveFunds: mocks.openReceiveFunds,
        openAccountOptions: mocks.openAccountOptions,
    }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mocks.copyToClipboard }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@hooks/useLanguage')

describe('useWatchAccountButtonPanel', () => {
    beforeEach(() => {
        mocks.account = {
            id: 'watch-1',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'WATCH_ADDRESS' } },
        }
    })

    it('copies the account address and confirms with a toast', () => {
        const { result } = renderHook(() => useWatchAccountButtonPanel())

        act(() => result.current.handleCopyAddress())

        expect(mocks.copyToClipboard).toHaveBeenCalledWith('WATCH_ADDRESS')
        expect(mocks.showToast).toHaveBeenCalledWith({
            title: 'account_options.copy_address',
            body: '',
            type: 'success',
        })
    })

    it('copies nothing when the account has no address on its chain', () => {
        mocks.account = { id: 'empty', custody: { kind: 'watch' }, chains: {} }
        const { result } = renderHook(() => useWatchAccountButtonPanel())

        act(() => result.current.handleCopyAddress())

        expect(mocks.copyToClipboard).not.toHaveBeenCalled()
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('opens the receive sheet for QR and account options for more', () => {
        const { result } = renderHook(() => useWatchAccountButtonPanel())

        act(() => result.current.handleShowQR())
        act(() => result.current.handleMore())

        expect(mocks.openReceiveFunds).toHaveBeenCalledTimes(1)
        expect(mocks.openAccountOptions).toHaveBeenCalledTimes(1)
    })
})

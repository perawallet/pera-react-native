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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRunCreateAccount } from '../useRunCreateAccount'

const mockPush = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mockPush }),
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-shared')),
    deferToNextCycle: (callback: () => Promise<void>) => callback(),
}))

const ACCOUNT = { id: 'new', chains: {} }

describe('useRunCreateAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the default progress title until a create overrides it', async () => {
        const { result } = renderHook(() => useRunCreateAccount())

        expect(result.current.creatingTitleKey).toBe(
            'onboarding.create_account.processing',
        )

        await act(async () => {
            result.current.runCreateAccount(
                () => new Promise(() => {}),
                'onboarding.add_account.quantum_creating_title' as never,
            )
        })

        expect(result.current.isCreatingAccount).toBe(true)
        expect(result.current.creatingTitleKey).toBe(
            'onboarding.add_account.quantum_creating_title',
        )
    })

    it('names the created account, then hides the progress overlay', async () => {
        const { result } = renderHook(() => useRunCreateAccount())

        await act(async () => {
            result.current.runCreateAccount(async () => ACCOUNT as never)
        })

        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: ACCOUNT,
        })
        expect(result.current.isCreatingAccount).toBe(false)
    })

    it('pushes nothing when the create returns no account', async () => {
        const { result } = renderHook(() => useRunCreateAccount())

        await act(async () => {
            result.current.runCreateAccount(async () => null)
        })

        expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows an error and hides the progress overlay when the create fails', async () => {
        const { result } = renderHook(() => useRunCreateAccount())

        await act(async () => {
            result.current.runCreateAccount(async () => {
                throw new Error('keygen failed')
            })
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
        )
        expect(result.current.isCreatingAccount).toBe(false)
    })
})

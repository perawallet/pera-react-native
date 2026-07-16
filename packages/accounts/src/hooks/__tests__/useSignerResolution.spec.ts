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

import { renderHook } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { useSignerResolution } from '../useSignerResolution'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useSignerResolution', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns accountNotFound when no address is provided', () => {
        const { result } = renderHook(() => useSignerResolution(null))
        expect(result.current).toEqual({ kind: 'accountNotFound' })
    })

    it('resolves an ok signer for a locally-held key account', () => {
        setAccounts([
            { type: 'algo25', address: 'A', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useSignerResolution('A'))
        expect(result.current.kind).toBe('ok')
        if (result.current.kind === 'ok') {
            expect(result.current.signer.address).toBe('A')
        }
    })

    it('surfaces authMissing when the rekey target is not held locally', () => {
        setAccounts([
            {
                type: 'watch',
                address: 'A',
                rekeyAddress: 'GONE',
            } as WalletAccount,
        ])
        const { result } = renderHook(() => useSignerResolution('A'))
        expect(result.current).toEqual({
            kind: 'authMissing',
            account: expect.objectContaining({ address: 'A' }),
            authAddress: 'GONE',
        })
    })
})

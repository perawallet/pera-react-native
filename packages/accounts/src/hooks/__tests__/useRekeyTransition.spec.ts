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
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useRekeyTransition } from '../useRekeyTransition'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    fakeAccountsChain,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    ({
        id: address,
        custody: { kind: 'local', seed: 'algo25' },
        address,
        keyPairId: 'k',
        ...extra,
    }) as WalletAccount

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useRekeyTransition', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        registerFakeAccountsChain()
    })

    it('returns null when no address is provided', () => {
        const { result } = renderHook(() => useRekeyTransition(null))
        expect(result.current).toBeNull()
    })

    it('returns null when the address is not in the wallet', () => {
        setAccounts([])
        const { result } = renderHook(() => useRekeyTransition('A'))
        expect(result.current).toBeNull()
    })

    it('returns null for a non-rekeyed account', () => {
        setAccounts([held('A')])
        const { result } = renderHook(() => useRekeyTransition('A'))
        expect(result.current).toBeNull()
    })

    it("returns the from/to types from the chain's signer for a rekeyed account", () => {
        const signer = held('S')
        setAccounts([
            held('A', {
                custody: { kind: 'watch' },
                keyPairId: undefined,
                rekeyAddress: 'S',
            }),
            signer,
        ])
        vi.mocked(fakeAccountsChain().adapter.resolveSigner).mockReturnValue({
            kind: 'ok',
            signer,
        })

        const { result } = renderHook(() => useRekeyTransition('A'))

        expect(result.current).toEqual({ from: 'watch', to: 'algo25' })
    })
})

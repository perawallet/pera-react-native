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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { useSigningAccounts } from '../useSigningAccounts'
import { useAccountsStore } from '../../store'
import { testAccount } from '../../__tests__/accountFactory'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE,
    fakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'

describe('useSigningAccounts', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useNetworkStore.getState().setNetwork('mainnet')
    })

    it('keeps the accounts the chain resolves a signer for', () => {
        const local = testAccount('local', 'A')
        const watch = testAccount('watch', 'B')
        const hd = testAccount('hd', 'C')
        useAccountsStore.getState().setAccounts([local, watch, hd])

        const { result } = renderHook(() => useSigningAccounts(FAKE_CHAIN_ID))

        expect(result.current).toEqual([local, hd])
        expect(fakeAccountsChain().adapter.resolveSigner).toHaveBeenCalledWith(
            watch,
            [local, watch, hd],
            MAINNET_SCOPE,
        )
    })

    it('includes a watch account the chain resolves a held signer for', () => {
        const signer = testAccount('local', 'SIGNER')
        const rekeyed = testAccount('watch', 'REKEYED')
        useAccountsStore.getState().setAccounts([signer, rekeyed])
        vi.mocked(fakeAccountsChain().adapter.resolveSigner).mockReturnValue({
            kind: 'ok',
            signer,
        })

        const { result } = renderHook(() => useSigningAccounts(FAKE_CHAIN_ID))

        expect(result.current).toEqual([signer, rekeyed])
    })

    it('is empty when nothing can sign', () => {
        useAccountsStore
            .getState()
            .setAccounts([testAccount('watch', 'A'), testAccount('watch', 'B')])

        const { result } = renderHook(() => useSigningAccounts(FAKE_CHAIN_ID))

        expect(result.current).toEqual([])
    })

    it('is empty with no accounts', () => {
        const { result } = renderHook(() => useSigningAccounts(FAKE_CHAIN_ID))

        expect(result.current).toEqual([])
    })
})

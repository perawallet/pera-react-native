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
import { describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { useSignRequestScope } from '../useSignRequestScope'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

const ETH_SCOPE = { chainId: 'ethereum', networkId: 'sepolia' } as ChainScope

const transactionRequest = (scope: ChainScope) =>
    ({
        id: 'r1',
        type: 'transactions',
        transport: 'callback',
        txs: [{ scope, payload: {} }],
    }) as unknown as SignRequest

describe('useSignRequestScope', () => {
    it("returns a transaction request's own network rather than the selected one", () => {
        const request = transactionRequest(ETH_SCOPE)

        const { result } = renderHook(() => useSignRequestScope(request))

        expect(result.current).toBe(ETH_SCOPE)
    })

    it('returns the scope a message request names', () => {
        const request = {
            id: 'r2',
            type: 'message',
            message: { scope: ETH_SCOPE },
        } as unknown as SignRequest

        const { result } = renderHook(() => useSignRequestScope(request))

        expect(result.current).toBe(ETH_SCOPE)
    })

    it('uses the selected network of the chain an arbitrary-data request is stamped with', () => {
        const request = {
            id: 'r3',
            type: 'arbitrary-data',
            chainId: 'ethereum',
            data: [],
        } as unknown as SignRequest

        const { result } = renderHook(() => useSignRequestScope(request))

        expect(result.current).toEqual({
            chainId: 'ethereum',
            networkId: 'mainnet',
        })
    })

    it('uses the first registered chain when there is no request', () => {
        const { result } = renderHook(() => useSignRequestScope(undefined))

        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
    })
})

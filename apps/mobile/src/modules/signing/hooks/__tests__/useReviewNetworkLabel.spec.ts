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
import { useReviewNetworkLabel } from '../useReviewNetworkLabel'

const SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as ChainScope

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ currentRequest: { id: 'request-1' } }),
}))

vi.mock('../useSignRequestScope', () => ({
    useSignRequestScope: () => SEPOLIA,
}))

vi.mock('@utils/chainNetwork', () => ({
    chainNetworkOf: ({ networkId }: ChainScope) => ({
        chain: 'Ethereum',
        network: networkId === 'sepolia' ? 'Sepolia' : networkId,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params: { chain: string; network: string }) =>
            `${key}: ${params.chain} ${params.network}`,
    }),
}))

describe('useReviewNetworkLabel', () => {
    it("names the network of the request's own scope", () => {
        const { result } = renderHook(() => useReviewNetworkLabel())

        expect(result.current).toBe(
            'dapp.approval.chain_network: Ethereum Sepolia',
        )
    })
})

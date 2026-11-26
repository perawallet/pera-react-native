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
import { useSwapTrackingStore } from '@perawallet/wallet-core-swaps'
import { useTrackedSwapLegs } from '../useTrackedSwapLegs'

vi.mock('@perawallet/wallet-core-transactions', () => ({
    swapLegRoleOf: (role: string) =>
        ({ deposit: 'source', payout: 'payout' })[role],
}))

describe('useTrackedSwapLegs', () => {
    it("keys each tracked order's fund-moving transactions by lowercase hash", () => {
        const state = {
            orders: {
                o1: {
                    orderId: 'o1',
                    transactions: [
                        { txHash: '0xDEP', role: 'deposit' },
                        { txHash: '0xAPPROVE', role: 'approval' },
                        { txHash: '0xPAY', role: 'payout' },
                    ],
                },
                o2: { orderId: 'o2' },
            },
        }
        vi.mocked(useSwapTrackingStore).mockImplementation(((
            selector: (s: typeof state) => unknown,
        ) => selector(state)) as never)

        const { result } = renderHook(() => useTrackedSwapLegs())

        expect([...result.current]).toEqual([
            ['0xdep', { orderId: 'o1', role: 'source' }],
            ['0xpay', { orderId: 'o1', role: 'payout' }],
        ])
    })
})

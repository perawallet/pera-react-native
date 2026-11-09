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

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { algorandRampAdapter as adapter } from '../adapter'

const { mockEnsureOptIn } = vi.hoisted(() => ({ mockEnsureOptIn: vi.fn() }))

vi.mock('../useEnsureDestinationOptIn', () => ({
    useEnsureDestinationOptIn: () => ({ ensureOptIn: mockEnsureOptIn }),
}))

describe('algorandRampAdapter', () => {
    it('reads the same router asset id the swap adapter does', () => {
        expect(
            adapter.fromRouterAssetId(
                'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe/asa:31566704',
                { chainId: 'algorand', networkId: 'testnet' },
            ),
        ).toBe('31566704')
    })

    it("does not read a mainnet id on the testnet's scope", () => {
        expect(
            adapter.fromRouterAssetId(
                'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k/asa:31566704',
                { chainId: 'algorand', networkId: 'testnet' },
            ),
        ).toBeNull()
    })

    it('prepares the destination with the ASA opt-in', () => {
        const { result } = renderHook(() => adapter.useEnsureCanReceive?.())

        expect(result.current).toBe(mockEnsureOptIn)
    })
})

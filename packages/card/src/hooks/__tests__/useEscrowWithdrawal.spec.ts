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
import type { CardChainAdapter } from '../../chain-adapter'
import { registerFakeCardAdapter } from '../../__tests__/fakeCardAdapter'

const { useNetwork } = vi.hoisted(() => ({ useNetwork: vi.fn() }))
vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork,
}))

import { useEscrowWithdrawal } from '../useEscrowWithdrawal'

const CARD = 'CARD'
const OWNER = 'OWNER'

let adapter: CardChainAdapter

beforeEach(() => {
    vi.clearAllMocks()
    useNetwork.mockReturnValue({ network: 'testnet' })
    adapter = registerFakeCardAdapter()
})

describe('useEscrowWithdrawal', () => {
    it("builds each withdrawal step through the network's chain adapter", async () => {
        const txns = [{ id: 'txn-1' }]
        vi.mocked(adapter.withdrawal.buildRequest).mockResolvedValue(
            txns as never,
        )
        const { result } = renderHook(() => useEscrowWithdrawal())

        await expect(
            result.current.buildRequest({
                sender: OWNER,
                cardAddress: CARD,
                amount: 100_000n,
            }),
        ).resolves.toBe(txns)
        await result.current.buildWithdraw({
            sender: OWNER,
            cardAddress: CARD,
            amount: 100_000n,
        })
        await result.current.buildCancel({ sender: OWNER, cardAddress: CARD })

        const expected = {
            network: 'testnet',
            sender: OWNER,
            cardAddress: CARD,
        }
        expect(adapter.withdrawal.buildRequest).toHaveBeenCalledWith({
            ...expected,
            amount: 100_000n,
        })
        expect(adapter.withdrawal.buildWithdraw).toHaveBeenCalledWith({
            ...expected,
            amount: 100_000n,
        })
        expect(adapter.withdrawal.buildCancel).toHaveBeenCalledWith(expected)
    })

    it('reads the pending request and wait time for the current network', async () => {
        const pending = {
            card: CARD,
            recipient: OWNER,
            asset: '10458941',
            amount: 100_000n,
            createdAt: 1_700_000_000,
            nonce: 3n,
        }
        vi.mocked(adapter.withdrawal.getPending).mockResolvedValue(pending)
        vi.mocked(adapter.withdrawal.getWaitTimeSeconds).mockResolvedValue(20)
        const { result } = renderHook(() => useEscrowWithdrawal())

        await expect(result.current.getPendingWithdrawal(OWNER)).resolves.toBe(
            pending,
        )
        await expect(result.current.getWaitTimeSeconds()).resolves.toBe(20)
        expect(adapter.withdrawal.getPending).toHaveBeenCalledWith(
            'testnet',
            OWNER,
        )
        expect(adapter.withdrawal.getWaitTimeSeconds).toHaveBeenCalledWith(
            'testnet',
        )
    })
})

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

import { describe, it, expect, vi } from 'vitest'
import { createSigningMachine } from '../createSigningMachine'
import type { SigningMachineDeps } from '../context'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { TransactionSignRequest } from '../../models'

const MOCK_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAccount = {
    type: 'algo25',
    address: MOCK_ADDRESS,
    keyPairId: 'key-1',
} as unknown as WalletAccount

const mockRequest: TransactionSignRequest = {
    id: 'req-create-1',
    type: 'transactions',
    transport: 'algod',
    txs: [
        {
            sender: { toString: () => MOCK_ADDRESS },
            fee: 1000n,
            type: 'pay',
        } as never,
    ],
}

const makeDeps = (): SigningMachineDeps =>
    ({
        signTransactions: vi.fn(),
        signArbitraryData: vi.fn(),
        signArc60: vi.fn(),
        createTransport: vi.fn(),
        network: 'mainnet',
        encodeTransaction: vi.fn(),
    }) as never

describe('createSigningMachine', () => {
    it('creates an actor with the request id as the actor id', () => {
        const actor = createSigningMachine(
            mockRequest,
            [mockAccount],
            makeDeps(),
        )
        expect(actor.id).toBe(mockRequest.id)
    })

    it('threads request + allAccounts + deps into the machine input', () => {
        const deps = makeDeps()
        const actor = createSigningMachine(mockRequest, [mockAccount], deps)
        actor.start()
        const ctx = actor.getSnapshot().context
        expect(ctx.request).toBe(mockRequest)
        expect(ctx.allAccounts).toEqual([mockAccount])
        // Each dep function is forwarded by reference into context.deps.
        expect(ctx.deps.signTransactions).toBe(deps.signTransactions)
        expect(ctx.deps.signArbitraryData).toBe(deps.signArbitraryData)
        expect(ctx.deps.signArc60).toBe(deps.signArc60)
        expect(ctx.deps.createTransport).toBe(deps.createTransport)
        expect(ctx.deps.encodeTransaction).toBe(deps.encodeTransaction)
        expect(ctx.deps.network).toBe(deps.network)
        actor.stop()
    })

    it('returns an actor that can be started and exposes a snapshot', () => {
        const actor = createSigningMachine(
            mockRequest,
            [mockAccount],
            makeDeps(),
        )
        actor.start()
        // The machine resolves context synchronously in idle and immediately
        // advances — just confirm the actor is alive and a snapshot exists.
        const snapshot = actor.getSnapshot()
        expect(snapshot).toBeDefined()
        expect(typeof snapshot.value).not.toBe('undefined')
        actor.stop()
    })
})

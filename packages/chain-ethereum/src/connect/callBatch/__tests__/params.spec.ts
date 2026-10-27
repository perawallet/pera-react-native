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

import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import {
    MAX_CALLS_PER_BATCH,
    refuseUnsupportedSendCalls,
    validateEthereumSendCalls,
} from '../params'

const FROM = getAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
const OTHER = getAddress('0x2c7536E3605D9C16a7a3D7b1898e529396a65c23')
const TOKEN = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
const ROUTER = getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
const session = { authorizedAccounts: [FROM], eip155ChainId: 1 }

const APPROVE = { to: TOKEN, data: '0x095ea7b3' }
const SWAP = { to: ROUTER, data: '0x5ae401dc', value: '0x10' }

const batch = (overrides: Record<string, unknown> = {}) => [
    {
        version: '2.0.0',
        chainId: '0x1',
        from: FROM,
        atomicRequired: false,
        calls: [APPROVE, SWAP],
        ...overrides,
    },
]

describe('refuseUnsupportedSendCalls', () => {
    it('lets a non-atomic batch with no required capability through', () => {
        expect(refuseUnsupportedSendCalls(batch())).toBeNull()
        expect(
            refuseUnsupportedSendCalls(
                batch({
                    capabilities: { paymasterService: { optional: true } },
                }),
            ),
        ).toBeNull()
    })

    it('refuses atomicRequired with 5760', () => {
        expect(
            refuseUnsupportedSendCalls(batch({ atomicRequired: true })),
        ).toMatchObject({ code: 5760 })
    })

    it('refuses a capability not marked optional with 5700', () => {
        expect(
            refuseUnsupportedSendCalls(
                batch({ capabilities: { paymasterService: { url: 'x' } } }),
            ),
        ).toMatchObject({ code: 5700 })
        expect(
            refuseUnsupportedSendCalls(
                batch({ calls: [{ ...APPROVE, capabilities: { x: {} } }] }),
            ),
        ).toMatchObject({ code: 5700 })
    })

    it('leaves malformed params to validation', () => {
        expect(refuseUnsupportedSendCalls([])).toBeNull()
        expect(refuseUnsupportedSendCalls('nope')).toBeNull()
    })
})

describe('validateEthereumSendCalls', () => {
    it('validates every call with the batch sender, in order', () => {
        expect(
            validateEthereumSendCalls(batch({ id: 'batch-1' }), session),
        ).toEqual({
            ok: true,
            request: {
                batchId: 'batch-1',
                from: FROM,
                calls: [
                    { from: FROM, to: TOKEN, value: 0n, data: '0x095ea7b3' },
                    { from: FROM, to: ROUTER, value: 16n, data: '0x5ae401dc' },
                ],
            },
        })
    })

    it("sends from the session's first account when the dApp names none", () => {
        const result = validateEthereumSendCalls(batch({ from: undefined }), {
            ...session,
            authorizedAccounts: [FROM, OTHER],
        })

        expect(result).toMatchObject({ ok: true, request: { from: FROM } })
    })

    it('refuses a chainId that is not the active chain with 5710', () => {
        expect(
            validateEthereumSendCalls(batch({ chainId: '0xaa36a7' }), session),
        ).toMatchObject({ ok: false, failure: 'coded', code: 5710 })
        expect(
            validateEthereumSendCalls(batch(), {
                ...session,
                eip155ChainId: undefined,
            }),
        ).toMatchObject({ ok: false, failure: 'coded', code: 5710 })
    })

    it('refuses atomicRequired with 5760 even past the router', () => {
        expect(
            validateEthereumSendCalls(batch({ atomicRequired: true }), session),
        ).toMatchObject({ ok: false, failure: 'coded', code: 5760 })
    })

    it.each([
        ['no calls', { calls: [] }],
        [
            'too many calls',
            {
                calls: Array.from(
                    { length: MAX_CALLS_PER_BATCH + 1 },
                    () => APPROVE,
                ),
            },
        ],
        ['no atomicRequired', { atomicRequired: undefined }],
        ['a malformed chainId', { chainId: 1 }],
        ['an empty id', { id: '' }],
        ['an oversized id', { id: 'x'.repeat(4097) }],
        ['a call that is not an object', { calls: ['0x'] }],
        ['a call creating a contract', { calls: [{ data: '0x6000' }] }],
        ['a call with odd calldata', { calls: [{ to: TOKEN, data: '0x123' }] }],
    ])('refuses %s as invalid params', (_, overrides) => {
        expect(
            validateEthereumSendCalls(batch(overrides), session),
        ).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })

    it('names the call that broke a rule', () => {
        expect(
            validateEthereumSendCalls(
                batch({ calls: [APPROVE, { to: 'nope' }] }),
                session,
            ),
        ).toMatchObject({
            ok: false,
            message: expect.stringMatching(/^Call 1: /),
        })
    })

    it('refuses a sender the session does not hold as unauthorized', () => {
        expect(
            validateEthereumSendCalls(batch({ from: OTHER }), session),
        ).toMatchObject({ ok: false, failure: 'unauthorized-account' })
    })
})

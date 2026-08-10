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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { Networks } from '@perawallet/wallet-core-shared'
import { AlgorandChainId } from '../../models'
import { gateSignTxnRequest, gateSignDataRequest } from '../inboundRequestGate'

// `../schema` re-exports `arc60WireSchema`/`assertArc60RequestWithinLimits`
// from `@perawallet/wallet-core-signing`, whose barrel drags in RN-only deps
// (react-native-mmkv) that don't resolve in this test environment. Mock the
// package the same way `connectorRegistry.test.ts` does, keeping the numeric
// limits at their real value (1000) so the "too many" tests still mean
// something, and mirroring the real ARC-60 wire shape so schema-shape
// assertions stay meaningful. `vi.hoisted` so the mock fn reference survives
// past `vi.mock`'s hoisting and can be reconfigured per-test.
const mocks = vi.hoisted(() => ({
    assertArc60RequestWithinLimits: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 1000,
    MAX_TRANSACTION_SIGN_REQUESTS: 1000,
    arc60WireSchema: z.object({
        data: z.string().max(16 * 1024),
        signer: z.string().min(1).max(128),
        domain: z.string().min(1).max(256),
        authenticatorData: z.string().min(1).max(512),
        requestId: z.string().max(256).optional(),
        hdPath: z.string().max(256).optional(),
        metadata: z.object({
            scope: z.number().int(),
            encoding: z.string().min(1).max(32),
        }),
    }),
    assertArc60RequestWithinLimits: mocks.assertArc60RequestWithinLimits,
}))

beforeEach(() => {
    mocks.assertArc60RequestWithinLimits.mockReset()
})

const KNOWN = ['AAAA', 'BBBB']

const signTxnPayload = (params: unknown) => ({ id: 1, params })

const baseInput = {
    network: Networks.mainnet,
    sessionChainId: AlgorandChainId.mainnet as number | undefined,
    knownAddresses: KNOWN,
}

describe('gateSignTxnRequest', () => {
    it('accepts a well-formed request naming a known signer', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([[{ txn: 'dHhu', signers: ['AAAA'] }]]),
        })
        expect(result).toEqual({ ok: true })
    })

    it('accepts a request that names no addresses at all', () => {
        // Sender resolution needs full ARC-0001 decoding; the gate stays
        // conservative and defers rather than guessing.
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([[{ txn: 'dHhu' }]]),
        })
        expect(result).toEqual({ ok: true })
    })

    it('rejects a payload with no numeric id', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: { params: [[{ txn: 'dHhu' }]] },
        })
        expect(result.ok).toBe(false)
    })

    it('rejects a payload whose params is not an array', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload('nope'),
        })
        expect(result.ok).toBe(false)
    })

    it('rejects an empty transaction list', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([[]]),
        })
        expect(result.ok).toBe(false)
    })

    it('rejects an entry with no txn string', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([[{ signers: ['AAAA'] }]]),
        })
        expect(result.ok).toBe(false)
    })

    it('rejects a chain id for the other network', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            sessionChainId: AlgorandChainId.testnet,
            payload: signTxnPayload([[{ txn: 'dHhu' }]]),
        })
        expect(result.ok).toBe(false)
    })

    it('rejects when every named signer is unknown', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([[{ txn: 'dHhu', signers: ['ZZZZ'] }]]),
        })
        expect(result.ok).toBe(false)
    })

    it('accepts when at least one named signer is known', () => {
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([
                [
                    { txn: 'dHhu', signers: ['ZZZZ'] },
                    { txn: 'dHhu', signers: ['BBBB'] },
                ],
            ]),
        })
        expect(result).toEqual({ ok: true })
    })

    it('rejects more transactions than the shared limit allows', () => {
        const tooMany = Array.from({ length: 1001 }, () => ({ txn: 'dHhu' }))
        const result = gateSignTxnRequest({
            ...baseInput,
            payload: signTxnPayload([tooMany]),
        })
        expect(result.ok).toBe(false)
    })
})

const arc60Payload = (overrides: Record<string, unknown> = {}) => ({
    data: 'ZGF0YQ==',
    signer: 'AAAA',
    domain: 'example.com',
    authenticatorData: 'ZGF0YQ==',
    metadata: { scope: 1, encoding: 'base64' },
    ...overrides,
})

describe('gateSignDataRequest', () => {
    // algo_signData's wire envelope is `{ id, params: <arc60 object> }` — a
    // single object, unlike algo_signTxn's `[[...]]` array-of-arrays. Mobile's
    // handleSignData/handleArc60SignData (packages/walletconnect/src/hooks/
    // useWalletConnectHandlers.ts) confirm this: handleSignData routes to the
    // ARC-60 path only when `!Array.isArray(params)`, and
    // handleArc60SignData passes `payload.params` straight into
    // `arc60PayloadSchema.safeParse` with no `[0][0]` indexing.

    it('accepts a well-formed ARC-60 params object', () => {
        const result = gateSignDataRequest({
            payload: { id: 1, params: arc60Payload() },
            network: Networks.mainnet,
            sessionChainId: AlgorandChainId.mainnet,
        })
        expect(result).toEqual({ ok: true })
    })

    it('rejects a payload with no numeric id', () => {
        const result = gateSignDataRequest({
            payload: { params: arc60Payload() },
            network: Networks.mainnet,
            sessionChainId: AlgorandChainId.mainnet,
        })
        expect(result.ok).toBe(false)
    })

    it('rejects when params is an array (the algo_signTxn envelope shape arriving on the wrong method)', () => {
        const result = gateSignDataRequest({
            payload: { id: 1, params: [arc60Payload()] },
            network: Networks.mainnet,
            sessionChainId: AlgorandChainId.mainnet,
        })
        expect(result.ok).toBe(false)
    })

    it('rejects a chain id for the other network', () => {
        const result = gateSignDataRequest({
            payload: { id: 1, params: arc60Payload() },
            network: Networks.mainnet,
            sessionChainId: AlgorandChainId.testnet,
        })
        expect(result.ok).toBe(false)
    })

    it('rejects a payload that fails the ARC-60 schema', () => {
        const result = gateSignDataRequest({
            payload: { id: 1, params: {} },
            network: Networks.mainnet,
            sessionChainId: AlgorandChainId.mainnet,
        })
        expect(result.ok).toBe(false)
    })

    it('rejects an oversized ARC-60 payload', () => {
        mocks.assertArc60RequestWithinLimits.mockImplementationOnce(() => {
            throw new Error('request exceeds the maximum allowed size')
        })
        const result = gateSignDataRequest({
            payload: { id: 1, params: arc60Payload() },
            network: Networks.mainnet,
            sessionChainId: AlgorandChainId.mainnet,
        })
        // `../schema`'s assertArc60RequestWithinLimits wraps the underlying
        // signing-package error in a WalletConnectSignRequestError with a
        // prefixed message — assert on that real wrapping, not the raw text.
        expect(result).toEqual({
            ok: false,
            reason: 'Invalid ARC-60 sign request payload — request exceeds the maximum allowed size',
        })
    })
})

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
import { Networks } from '@perawallet/wallet-core-shared'
import {
    isArc60WirePayload,
    parseArc60WireRequest,
} from '@perawallet/wallet-core-signing'
import {
    AlgorandChainId,
    gateSignDataRequest,
} from '@perawallet/wallet-core-walletconnect'

// The repo-wide unit-test setup stubs '@perawallet/wallet-core-walletconnect'
// down to a handful of hook exports (vitest.setup.ts — it exists to keep
// integration tests off the real WC socket). This file needs the REAL
// gateSignDataRequest, so it opts back into the real module, same pattern as
// bindHeadlessHandlers.test.ts / wcHost.test.ts. `@perawallet/
// wallet-core-signing` (isArc60WirePayload / parseArc60WireRequest) is NOT
// mocked repo-wide, so it's already the real implementation here — nothing
// to opt out of.
vi.mock('@perawallet/wallet-core-walletconnect', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-walletconnect')
        >()
    return actual
})

// The repo-wide setup also stubs '@perawallet/wallet-core-shared' down to a
// curated subset for UI tests, missing `utf8ByteLength`/`decodeFromBase64`
// that the real gate (assertArc60RequestWithinLimits) and the real
// parseArc60WireRequest need. Opt back into the real module here too — its
// base64 helpers are backed by the pure-JS `base64-js` package, not a native
// module, so nothing RN-specific needs stubbing for this test.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return actual
})

/**
 * Regression guard for a gate/approval-surface shape mismatch on
 * `algo_signData`.
 *
 * `gateSignDataRequest` (offscreen's headless validation gate,
 * packages/walletconnect/src/validation/inboundRequestGate.ts) and
 * `isArc60WirePayload`/`parseArc60WireRequest` (the approval surface's ARC-60
 * reader — see `readArc60Params` + the `algo_signData` branch in
 * apps/mobile/src/modules/dapp/screens/SignRequestApprovalScreen/
 * useSignRequestApprovalScreen.ts) used to require MUTUALLY EXCLUSIVE shapes
 * for the exact same `algo_signData` WC payload:
 *   - the gate required `params` to be `[[arc60Object]]` — algo_signTxn's
 *     array-of-arrays envelope shape.
 *   - `isArc60WirePayload` requires `params` to be the ARC-60 object itself,
 *     and returns `false` for ANY array.
 * A payload could satisfy at most one of the two, so every real
 * `algo_signData` request either died at the gate or reached the approval
 * surface and was declined as an unsupported message — signing this method
 * was impossible end to end.
 *
 * Every other spec covering either half mocks the other side's predicate
 * (gate tests mock `arc60WireSchema`; the approval-screen spec mocks
 * `isArc60WirePayload`/`parseArc60WireRequest` outright), so the suite
 * stayed green with the two sides out of parity. This test deliberately uses
 * BOTH real, unmocked predicates against ONE fixture payload to make that
 * class of mismatch impossible to reintroduce silently.
 */
describe('algo_signData: gate <-> approval-surface shape parity', () => {
    const ARC60_FIXTURE = {
        data: 'ZGF0YQ==',
        signer: 'SIGNER_ADDR',
        domain: 'example.com',
        authenticatorData: 'ZGF0YQ==',
        metadata: { scope: 1, encoding: 'base64' },
    }

    // The real WC v1 `algo_signData` envelope: `{ id, params: <arc60 object> }`.
    const payload = { id: 42, params: ARC60_FIXTURE }

    it('passes the offscreen gate', () => {
        const result = gateSignDataRequest({
            payload,
            network: Networks.mainnet,
            sessionChainId: AlgorandChainId.mainnet,
        })
        expect(result).toEqual({ ok: true })
    })

    it('is also accepted by the approval surface real ARC-60 reader', () => {
        // Mirrors useSignRequestApprovalScreen.ts's (unexported)
        // readArc60Params, which is exactly `payload.params` for a `wc-sign`
        // approval — inlined here rather than exported for a one-liner.
        const params = (payload as { params: unknown }).params

        expect(isArc60WirePayload(params)).toBe(true)
        expect(() => parseArc60WireRequest(params)).not.toThrow()
        expect(parseArc60WireRequest(params).stdSigData.signer).toBe(
            'SIGNER_ADDR',
        )
    })
})

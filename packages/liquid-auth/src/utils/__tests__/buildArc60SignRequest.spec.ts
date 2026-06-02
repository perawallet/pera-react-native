/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// The mobile test setup replaces these packages with curated stubs; provide the
// real behaviour this pure builder needs (base64 + the ARC-60 zod schema),
// keeping canSignArc60 a controllable stub. base64/zod are pulled in a hoisted
// block so they're available to the (hoisted) module mocks.
const real = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toByteArray, fromByteArray } = require('base64-js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod')
    return {
        decodeFromBase64: (value: string) => toByteArray(value),
        encodeToBase64: (bytes: Uint8Array) => fromByteArray(bytes),
        generateOrderedUniqueId: () => 'test-ordered-id',
        arc60PayloadSchema: z.object({
            data: z.string(),
            signer: z.string().min(1),
            domain: z.string().min(1),
            authenticatorData: z.string().min(1),
            requestId: z.string().optional(),
            hdPath: z.string().optional(),
            metadata: z.object({
                scope: z.number().int(),
                encoding: z.string().min(1),
            }),
        }),
    }
})

vi.mock('@perawallet/wallet-core-shared', () => ({
    decodeFromBase64: real.decodeFromBase64,
    encodeToBase64: real.encodeToBase64,
    generateOrderedUniqueId: real.generateOrderedUniqueId,
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    arc60PayloadSchema: real.arc60PayloadSchema,
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    canSignArc60: vi.fn(() => true),
}))

import { canSignArc60 } from '@perawallet/wallet-core-accounts'
import type { LiquidAuthSession } from '../../models'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { buildArc60SignRequest } from '../buildArc60SignRequest'

const SIGNER = '2OJHIIG2FSD4NFB7IFGXYBGA3IE7UPJED766VQEUQHV7UDPKDM2B6NRMY4'

const validParams = {
    data: 'ZGF0YQ==',
    signer: SIGNER,
    domain: 'example.com',
    authenticatorData: 'AQIDBA==',
    metadata: { scope: 1, encoding: 'base64' },
}

const sessions = [
    {
        sessionId: 's1',
        accounts: [SIGNER],
        peerMeta: { name: 'dApp', origin: 'https://dapp' },
    } as unknown as LiquidAuthSession,
]
const accounts = [{ address: SIGNER } as unknown as WalletAccount]

const makeCallbacks = () => ({
    approve: vi.fn(),
    reject: vi.fn(),
    error: vi.fn(),
})

describe('buildArc60SignRequest', () => {
    beforeEach(() => {
        vi.mocked(canSignArc60).mockReturnValue(true)
    })

    it('builds an arc60 sign request for a valid payload', () => {
        const callbacks = makeCallbacks()
        const request = buildArc60SignRequest({
            params: validParams,
            transportId: 's1',
            sessions,
            accounts,
            callbacks,
        })

        expect(callbacks.error).not.toHaveBeenCalled()
        expect(request).toMatchObject({
            type: 'arc60',
            transport: 'callback',
            sourceType: 'liquidauth',
            transportId: 's1',
            metadata: { scope: 1, encoding: 'base64' },
            stdSigData: { signer: SIGNER, domain: 'example.com' },
        })
        // authenticatorData is base64-decoded to bytes for the pipeline.
        expect(request?.stdSigData.authenticatorData).toBeInstanceOf(Uint8Array)
    })

    it('delivers the base64-encoded signature back through approve', async () => {
        const callbacks = makeCallbacks()
        const request = buildArc60SignRequest({
            params: validParams,
            transportId: 's1',
            sessions,
            accounts,
            callbacks,
        })
        await request?.approve?.([
            { signature: new Uint8Array([1, 2, 3]), signer: SIGNER },
        ])
        expect(callbacks.approve).toHaveBeenCalledWith(['AQID'])
    })

    it('surfaces an error and returns null for an invalid payload', () => {
        const callbacks = makeCallbacks()
        const request = buildArc60SignRequest({
            params: { signer: SIGNER }, // missing data/domain/authenticatorData/metadata
            transportId: 's1',
            sessions,
            accounts,
            callbacks,
        })
        expect(request).toBeNull()
        expect(callbacks.error).toHaveBeenCalledOnce()
    })

    it('rejects a signer that is not connected for the session', () => {
        const callbacks = makeCallbacks()
        const request = buildArc60SignRequest({
            params: { ...validParams, signer: 'OTHER' },
            transportId: 's1',
            sessions,
            accounts,
            callbacks,
        })
        expect(request).toBeNull()
        expect(callbacks.error).toHaveBeenCalledOnce()
    })

    it('rejects a signer that cannot sign ARC-60 (watch/multisig)', () => {
        vi.mocked(canSignArc60).mockReturnValue(false)
        const callbacks = makeCallbacks()
        const request = buildArc60SignRequest({
            params: validParams,
            transportId: 's1',
            sessions,
            accounts,
            callbacks,
        })
        expect(request).toBeNull()
        expect(callbacks.error).toHaveBeenCalledOnce()
    })
})

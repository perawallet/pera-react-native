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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    ChainActionData,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { ChainActionBuildError } from '@perawallet/wallet-core-deeplinks'

const mocks = vi.hoisted(() => ({
    buildKeyRegistrationTx: vi.fn(),
    toUnsignedAlgorandTransaction: vi.fn(),
}))

vi.mock('../../transactions/builders', () => ({
    buildKeyRegistrationTx: mocks.buildKeyRegistrationTx,
}))

vi.mock('../../signing/unsignedTransaction', () => ({
    toUnsignedAlgorandTransaction: mocks.toUnsignedAlgorandTransaction,
}))

import { buildAlgorandChainAction } from '../chain-action'
import { algorandDeeplinkAdapter } from '../adapter'

const SENDER = '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const scope = { chainId: 'algorand', networkId: 'mainnet' } as ChainScope

const offline = (data: Partial<ChainActionData> = {}): ChainActionData => ({
    family: 'algorand',
    action: 'keyreg',
    sender: SENDER,
    keyregType: 'offline',
    ...data,
})

const online = (data: Partial<ChainActionData> = {}): ChainActionData =>
    offline({
        keyregType: 'online',
        voteKey: 'AAA',
        selectionKey: 'AAA',
        stateProofKey: 'AAA',
        voteFirst: '100',
        voteLast: '200',
        voteKeyDilution: '10',
        ...data,
    })

const builtParams = () =>
    mocks.buildKeyRegistrationTx.mock.calls[0][0] as Record<string, unknown>

describe('buildAlgorandChainAction', () => {
    beforeEach(() => {
        mocks.buildKeyRegistrationTx.mockReset()
        mocks.buildKeyRegistrationTx.mockResolvedValue({ kind: 'built' })
        mocks.toUnsignedAlgorandTransaction.mockReset()
        mocks.toUnsignedAlgorandTransaction.mockImplementation(
            (transaction: unknown, s: ChainScope) => ({
                scope: s,
                payload: { transaction },
            }),
        )
    })

    it('is the Algorand deeplink adapter’s chain-action builder', () => {
        expect(algorandDeeplinkAdapter.buildChainAction).toBe(
            buildAlgorandChainAction,
        )
    })

    it('builds an offline keyreg on the given scope and wraps it as an unsigned transaction', async () => {
        const result = await buildAlgorandChainAction(
            offline({ fee: new Decimal(2000) }),
            { scope },
        )

        expect(mocks.buildKeyRegistrationTx).toHaveBeenCalledExactlyOnceWith({
            kind: 'offline',
            scope,
            sender: SENDER,
            note: undefined,
            fee: 2000n,
        })
        expect(result).toEqual({
            scope,
            payload: { transaction: { kind: 'built' } },
        })
    })

    it('forwards every participation field of an online keyreg as bytes and bigints', async () => {
        await buildAlgorandChainAction(
            online({
                voteFirst: '1300',
                voteLast: '11300',
                voteKeyDilution: '100',
            }),
            { scope },
        )

        expect(builtParams()).toMatchObject({
            kind: 'online',
            sender: SENDER,
            voteFirst: 1300n,
            voteLast: 11_300n,
            voteKeyDilution: 100n,
        })
    })

    it('decodes unpadded and URL-safe base64 keys', async () => {
        // 32 bytes: unpadded base64 is 43 chars, which base64-js rejects
        // without re-padding.
        const bytes = Uint8Array.from({ length: 32 }, (_, i) => 250 - i)
        const standard = Buffer.from(bytes).toString('base64')
        const unpadded = standard.replace(/=+$/, '')
        const urlSafe = unpadded.replace(/\+/g, '-').replace(/\//g, '_')

        await buildAlgorandChainAction(
            online({
                voteKey: unpadded,
                selectionKey: urlSafe,
                stateProofKey: standard,
            }),
            { scope },
        )

        const params = builtParams()
        for (const key of ['voteKey', 'selectionKey', 'stateProofKey']) {
            expect(Array.from(params[key] as Uint8Array)).toEqual(
                Array.from(bytes),
            )
        }
    })

    it.each([
        'voteKey',
        'selectionKey',
        'stateProofKey',
        'voteFirst',
        'voteLast',
        'voteKeyDilution',
    ] as const)(
        'refuses an online keyreg missing %s without building',
        async field => {
            const build = buildAlgorandChainAction(
                online({ [field]: undefined }),
                { scope },
            )

            await expect(build).rejects.toBeInstanceOf(ChainActionBuildError)
            await expect(build).rejects.toMatchObject({
                reason: 'missing-fields',
                message: 'Missing required participation key fields',
            })
            expect(mocks.buildKeyRegistrationTx).not.toHaveBeenCalled()
        },
    )

    it('uses the editable note over xnote', async () => {
        await buildAlgorandChainAction(
            offline({ note: 'editable', xnote: 'locked' }),
            { scope },
        )

        expect(new TextDecoder().decode(builtParams().note as Uint8Array)).toBe(
            'editable',
        )
    })

    it('falls back to xnote when no editable note is provided', async () => {
        await buildAlgorandChainAction(offline({ xnote: 'locked' }), {
            scope,
        })

        expect(new TextDecoder().decode(builtParams().note as Uint8Array)).toBe(
            'locked',
        )
    })

    it('leaves the fee to the builder when the link sets none', async () => {
        await buildAlgorandChainAction(offline(), { scope })

        expect(builtParams().fee).toBeUndefined()
    })

    it('rejects, rather than throws synchronously, on a malformed round', async () => {
        await expect(
            buildAlgorandChainAction(online({ voteFirst: '1.5' }), { scope }),
        ).rejects.toThrow()
    })

    it('propagates a builder failure', async () => {
        const failure = new Error('algod refused to compute params')
        mocks.buildKeyRegistrationTx.mockRejectedValueOnce(failure)

        await expect(
            buildAlgorandChainAction(offline(), { scope }),
        ).rejects.toBe(failure)
    })
})

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

import { describe, test, expect, vi } from 'vitest'
import {
    createArc59SendSource,
    createArc59ClaimSource,
    createArc59RejectSource,
    type Arc59SourceDependencies,
} from '../createArc59Sources'

const makeDeps = (): Arc59SourceDependencies => ({
    appAddress: 'APP_ADDRESS',
    buildSendViaInboxTransactions: vi
        .fn()
        .mockResolvedValue([{ kind: 'send-1' }, { kind: 'send-2' }] as never),
    buildClaimTransactions: vi
        .fn()
        .mockResolvedValue([{ kind: 'claim-1' }] as never),
    buildRejectTransactions: vi
        .fn()
        .mockResolvedValue([
            { kind: 'reject-1' },
            { kind: 'reject-2' },
            { kind: 'reject-3' },
        ] as never),
    encodeTransaction: vi.fn().mockReturnValue(new Uint8Array([1])),
})

describe('createArc59SendSource', () => {
    test('builds send-via-inbox group signed entirely by sender', async () => {
        const deps = makeDeps()
        const source = createArc59SendSource(deps)

        const group = await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 10n,
            assetId: 999n,
            summary: {
                algoFundAmount: 0n,
                minimumBalanceRequirement: 100_000n,
                isArc59OptedIn: true,
                innerTxCount: 1,
            },
        })

        expect(deps.buildSendViaInboxTransactions).toHaveBeenCalled()
        expect(group.signerAddress).toBe('SENDER')
        if (group.data.type === 'transactions') {
            expect(group.data.transactions).toHaveLength(2)
            expect(group.data.indicesToSign).toEqual([0, 1])
        }
    })

    test('wraps build errors in SourceError', async () => {
        const deps = makeDeps()
        deps.buildSendViaInboxTransactions = vi
            .fn()
            .mockRejectedValue(new Error('build err'))
        const source = createArc59SendSource(deps)

        await expect(
            source.getSignableData({
                sender: 'S',
                receiver: 'R',
                amount: 0n,
                assetId: 0n,
                summary: {
                    algoFundAmount: 0n,
                    minimumBalanceRequirement: 0n,
                    isArc59OptedIn: true,
                    innerTxCount: 0,
                },
            }),
        ).rejects.toThrow('build err')
    })
})

describe('createArc59ClaimSource', () => {
    test('builds claim group and signs all by sender', async () => {
        const deps = makeDeps()
        const source = createArc59ClaimSource(deps)

        const group = await source.getSignableData({
            sender: 'CLAIMER',
            assetId: 100n,
            shouldClaimAlgo: true,
            isOptedIn: false,
        })

        expect(deps.buildClaimTransactions).toHaveBeenCalled()
        expect(group.signerAddress).toBe('CLAIMER')
        if (group.data.type === 'transactions') {
            expect(group.data.transactions).toHaveLength(1)
            expect(group.data.indicesToSign).toEqual([0])
        }
    })
})

describe('createArc59RejectSource', () => {
    test('builds reject group and signs all by sender', async () => {
        const deps = makeDeps()
        const source = createArc59RejectSource(deps)

        const group = await source.getSignableData({
            sender: 'REJECTER',
            assetId: 200n,
            shouldClaimAlgo: false,
        })

        expect(deps.buildRejectTransactions).toHaveBeenCalled()
        expect(group.signerAddress).toBe('REJECTER')
        if (group.data.type === 'transactions') {
            expect(group.data.transactions).toHaveLength(3)
            expect(group.data.indicesToSign).toEqual([0, 1, 2])
        }
    })
})

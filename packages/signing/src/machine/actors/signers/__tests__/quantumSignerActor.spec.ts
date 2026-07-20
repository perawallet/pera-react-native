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
import { createActor, toPromise } from 'xstate'
import { isQuantumSignedTransaction } from '@perawallet/wallet-core-blockchain'
import { quantumSignerActor } from '../quantumSignerActor'
import type { QuantumSignerActorInput } from '../quantumSignerActor'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const MOCK_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockQuantumAccount: WalletAccount = {
    type: 'quantum',
    address: MOCK_ADDRESS,
    keyPairId: 'key-q',
} as unknown as WalletAccount

const mockTransaction = { txn: {} } as never

const mockGroup: AnalyzedSignableGroup = {
    data: {
        type: 'transactions',
        transactions: [mockTransaction],
        indicesToSign: [0],
    },
    source: { type: 'local' },
    signerAddress: MOCK_ADDRESS,
    originalIndices: [0],
    analysis: {
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low',
    },
}

const mockCarrier = {
    txn: mockTransaction,
    pqSignedBytes: new Uint8Array([9, 9, 9]),
}

const buildInput = (
    overrides: Partial<QuantumSignerActorInput> = {},
): QuantumSignerActorInput => ({
    groups: [mockGroup],
    allAccounts: [mockQuantumAccount],
    signQuantumTransactions: vi.fn().mockResolvedValue([mockCarrier]),
    signArbitraryData: vi.fn(),
    signArc60: vi.fn(),
    ...overrides,
})

describe('quantumSignerActor', () => {
    it('returns a SigningResult per group carrying QuantumSignedTransaction results', async () => {
        const signQuantumTransactions = vi.fn().mockResolvedValue([mockCarrier])
        const input = buildInput({ signQuantumTransactions })

        const actor = createActor(quantumSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results).toHaveLength(1)
        const result = results[0]
        expect(result.signedData.type).toBe('transactions')
        if (result.signedData.type === 'transactions') {
            expect(result.signedData.signed).toEqual([mockCarrier])
            expect(
                isQuantumSignedTransaction(result.signedData.signed[0]),
            ).toBe(true)
        }
        expect(result.signers[0].address).toBe(MOCK_ADDRESS)
        expect(result.signers[0].accountType).toBe('quantum')
        if (mockGroup.data.type === 'transactions') {
            expect(signQuantumTransactions).toHaveBeenCalledWith(
                mockGroup.data.transactions,
                mockGroup.data.indicesToSign,
                mockQuantumAccount,
            )
        }
    })

    it('rejects when signQuantumTransactions throws', async () => {
        const signQuantumTransactions = vi
            .fn()
            .mockRejectedValue(new Error('KMS error'))
        const input = buildInput({ signQuantumTransactions })

        const actor = createActor(quantumSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow('KMS error')
    })

    it('rejects when group signerAddress is not in allAccounts', async () => {
        const signQuantumTransactions = vi.fn()
        const input = buildInput({
            allAccounts: [],
            signQuantumTransactions,
        })

        const actor = createActor(quantumSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow()
        expect(signQuantumTransactions).not.toHaveBeenCalled()
    })
})

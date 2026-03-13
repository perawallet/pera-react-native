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

import { describe, it, expect, vi } from 'vitest'
import { createActor, toPromise } from 'xstate'
import { localKeySignerActor } from '../localKeySignerActor'
import type { LocalKeySignerActorInput } from '../localKeySignerActor'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockAlgo25Account: WalletAccount = {
    type: 'algo25',
    address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    keyPairId: 'key-1',
} as unknown as WalletAccount

const mockTransaction = { txn: {} } as never

const mockGroup: AnalyzedSignableGroup = {
    data: {
        type: 'transactions',
        transactions: [mockTransaction],
        indicesToSign: [0],
    },
    source: { type: 'local' },
    analysis: {
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low',
    },
}

const mockSignedTxn = { txn: {}, sig: new Uint8Array([1, 2, 3]) } as never

describe('localKeySignerActor', () => {
    it('returns a SigningResult per group with signed transactions', async () => {
        const signTransactions = vi.fn().mockResolvedValue([mockSignedTxn])
        const input: LocalKeySignerActorInput = {
            groups: [mockGroup],
            signerAccount: mockAlgo25Account,
            signTransactions,
        }

        const actor = createActor(localKeySignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results).toHaveLength(1)
        const result = results[0]
        expect(result.signedData.type).toBe('transactions')
        if (result.signedData.type === 'transactions') {
            expect(result.signedData.signed).toEqual([mockSignedTxn])
        }
        expect(result.signers).toHaveLength(1)
        expect(result.signers[0].address).toBe(mockAlgo25Account.address)
        if (mockGroup.data.type === 'transactions') {
            expect(signTransactions).toHaveBeenCalledWith(
                mockGroup.data.transactions,
                mockGroup.data.indicesToSign,
            )
        }
    })

    it('rejects when signTransactions throws', async () => {
        const signTransactions = vi
            .fn()
            .mockRejectedValue(new Error('KMS error'))
        const input: LocalKeySignerActorInput = {
            groups: [mockGroup],
            signerAccount: mockAlgo25Account,
            signTransactions,
        }

        const actor = createActor(localKeySignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow('KMS error')
    })

    it('rejects when account has no signing keys', async () => {
        const accountWithoutKeys: WalletAccount = {
            type: 'multisig',
            address:
                'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        } as unknown as WalletAccount

        const signTransactions = vi.fn()
        const input: LocalKeySignerActorInput = {
            groups: [mockGroup],
            signerAccount: accountWithoutKeys,
            signTransactions,
        }

        const actor = createActor(localKeySignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow()
        expect(signTransactions).not.toHaveBeenCalled()
    })
})

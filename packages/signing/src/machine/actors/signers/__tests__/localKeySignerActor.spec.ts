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
import { localKeySignerActor } from '../localKeySignerActor'
import type { LocalKeySignerActorInput } from '../localKeySignerActor'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const MOCK_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAlgo25Account: WalletAccount = {
    type: 'algo25',
    address: MOCK_ADDRESS,
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
    signerAddress: MOCK_ADDRESS,
    analysis: {
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low',
    },
}

const mockSignedTxn = { txn: {}, sig: new Uint8Array([1, 2, 3]) } as never

const buildInput = (
    overrides: Partial<LocalKeySignerActorInput> = {},
): LocalKeySignerActorInput => ({
    groups: [mockGroup],
    allAccounts: [mockAlgo25Account],
    signTransactions: vi.fn().mockResolvedValue([mockSignedTxn]),
    signArbitraryData: vi.fn(),
    signArc60: vi.fn(),
    ...overrides,
})

describe('localKeySignerActor', () => {
    it('returns a SigningResult per group with signed transactions', async () => {
        const signTransactions = vi.fn().mockResolvedValue([mockSignedTxn])
        const input = buildInput({ signTransactions })

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
        expect(result.signers[0].address).toBe(MOCK_ADDRESS)
        if (mockGroup.data.type === 'transactions') {
            expect(signTransactions).toHaveBeenCalledWith(
                mockGroup.data.transactions,
                mockGroup.data.indicesToSign,
                mockAlgo25Account,
            )
        }
    })

    it('rejects when signTransactions throws', async () => {
        const signTransactions = vi
            .fn()
            .mockRejectedValue(new Error('KMS error'))
        const input = buildInput({ signTransactions })

        const actor = createActor(localKeySignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow('KMS error')
    })

    it('rejects when account has no signing keys', async () => {
        const multisigAddress =
            'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
        const accountWithoutKeys: WalletAccount = {
            type: 'multisig',
            address: multisigAddress,
        } as unknown as WalletAccount

        const groupForMultisig: AnalyzedSignableGroup = {
            ...mockGroup,
            signerAddress: multisigAddress,
        }

        const signTransactions = vi.fn()
        const input = buildInput({
            groups: [groupForMultisig],
            allAccounts: [accountWithoutKeys],
            signTransactions,
        })

        const actor = createActor(localKeySignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow()
        expect(signTransactions).not.toHaveBeenCalled()
    })

    it('rejects when group signerAddress is not in allAccounts', async () => {
        const signTransactions = vi.fn()
        const input = buildInput({
            allAccounts: [], // no matching account
            signTransactions,
        })

        const actor = createActor(localKeySignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow()
        expect(signTransactions).not.toHaveBeenCalled()
    })

    describe('rekeyed signer accounts', () => {
        const PARTICIPANT =
            'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP'
        const AUTH =
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU'

        const participantAccount: WalletAccount = {
            type: 'algo25',
            address: PARTICIPANT,
            keyPairId: 'key-participant',
            rekeyAddress: AUTH,
        } as unknown as WalletAccount

        const authAccount: WalletAccount = {
            type: 'algo25',
            address: AUTH,
            keyPairId: 'key-auth',
        } as unknown as WalletAccount

        const buildGroup = (
            sourceType: 'local' | 'multisig-cosign',
        ): AnalyzedSignableGroup => ({
            ...mockGroup,
            signerAddress: PARTICIPANT,
            source:
                sourceType === 'multisig-cosign'
                    ? {
                          type: 'multisig-cosign',
                          signRequestId: 'sr-1',
                          requestId: 'req-1',
                      }
                    : { type: 'local' },
        })

        it("uses participant's own key for multisig-cosign even when rekeyed (rekey is irrelevant for multisig participation)", async () => {
            const signTransactions = vi.fn().mockResolvedValue([mockSignedTxn])
            const input = buildInput({
                groups: [buildGroup('multisig-cosign')],
                allAccounts: [participantAccount, authAccount],
                signTransactions,
            })

            const actor = createActor(localKeySignerActor, { input })
            actor.start()
            const results = await toPromise(actor)

            expect(signTransactions).toHaveBeenCalledTimes(1)
            const [, , accountUsed] = signTransactions.mock.calls[0]
            expect(accountUsed.address).toBe(PARTICIPANT)
            expect(results[0].signers[0].address).toBe(PARTICIPANT)
        })

        it('follows rekey for non-cosign sources (regular tx with rekeyed sender → auth account signs)', async () => {
            const signTransactions = vi.fn().mockResolvedValue([mockSignedTxn])
            const input = buildInput({
                groups: [buildGroup('local')],
                allAccounts: [participantAccount, authAccount],
                signTransactions,
            })

            const actor = createActor(localKeySignerActor, { input })
            actor.start()
            const results = await toPromise(actor)

            expect(signTransactions).toHaveBeenCalledTimes(1)
            const [, , accountUsed] = signTransactions.mock.calls[0]
            expect(accountUsed.address).toBe(AUTH)
            expect(results[0].signers[0].address).toBe(AUTH)
        })
    })
})

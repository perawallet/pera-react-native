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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    SigningStrategy,
    SigningResult,
    AnalyzedSignableGroup,
} from '../../types'
import { NoLocalParticipantsError } from '../../errors'
import { createMultisigStrategy } from '../createMultisigStrategy'

const makeMultisigAccount = (address: string): WalletAccount =>
    ({
        type: 'multisig',
        address,
        multisigDetails: {
            version: 1,
            threshold: 2,
            addresses: ['PARTICIPANT_A', 'PARTICIPANT_B'],
        },
    }) as any

const makeAlgo25Account = (address: string): WalletAccount =>
    ({
        type: 'algo25',
        address,
        keyPairId: 'key-1',
    }) as any

const makeSigningResult = (address: string): SigningResult => ({
    signedData: {
        type: 'transactions',
        signed: [],
    },
    signers: [{ address }],
})

const makeSigningResultWithSigs = (
    address: string,
    sigs: Uint8Array[],
): SigningResult => ({
    signedData: {
        type: 'transactions',
        signed: sigs.map(sig => ({ sig }) as any),
    },
    signers: [{ address }],
})

const makeAnalyzedGroup = (): AnalyzedSignableGroup =>
    ({
        source: { type: 'walletConnect' },
        data: { type: 'transactions', transactions: [], indicesToSign: [] },
        analysis: {
            totalFees: 0n,
            transactionSummaries: [],
            warnings: [],
            signableAddresses: [],
            riskLevel: 'low',
        },
    }) as any

describe('createMultisigStrategy', () => {
    const participantA = makeAlgo25Account('PARTICIPANT_A')
    const participantB = makeAlgo25Account('PARTICIPANT_B')
    const allAccounts = [participantA, participantB]

    const makeStrategy = (
        localParticipants: WalletAccount[] = [participantA, participantB],
    ) => {
        const mockParticipantStrategy: SigningStrategy = {
            canSign: () => true,
            sign: vi.fn((_group, account) =>
                Promise.resolve(makeSigningResult(account.address)),
            ),
        }

        return {
            strategy: createMultisigStrategy({
                getLocalParticipants: () => localParticipants,
                getStrategyForParticipant: () => mockParticipantStrategy,
                getAllAccounts: () => allAccounts,
            }),
            mockParticipantStrategy,
        }
    }

    describe('canSign', () => {
        test('returns true for multisig accounts', () => {
            const { strategy } = makeStrategy()
            expect(strategy.canSign(makeMultisigAccount('MSIG'))).toBe(true)
        })

        test('returns false for non-multisig accounts', () => {
            const { strategy } = makeStrategy()
            expect(strategy.canSign(makeAlgo25Account('ADDR'))).toBe(false)
        })
    })

    describe('sign', () => {
        test('signs with each local participant and combines results', async () => {
            const { strategy, mockParticipantStrategy } = makeStrategy()
            const group = makeAnalyzedGroup()
            const multisigAccount = makeMultisigAccount('MSIG')

            const result = await strategy.sign(group, multisigAccount)

            expect(mockParticipantStrategy.sign).toHaveBeenCalledTimes(2)
            expect(result.signers).toHaveLength(2)
            expect(result.signers[0].address).toBe('PARTICIPANT_A')
            expect(result.signers[1].address).toBe('PARTICIPANT_B')
        })

        test('uses signed data from first participant result', async () => {
            const { strategy } = makeStrategy()
            const group = makeAnalyzedGroup()
            const multisigAccount = makeMultisigAccount('MSIG')

            const result = await strategy.sign(group, multisigAccount)

            expect(result.signedData.type).toBe('transactions')
        })

        test('throws NoLocalParticipantsError when no participants found', async () => {
            const { strategy } = makeStrategy([])
            const group = makeAnalyzedGroup()
            const multisigAccount = makeMultisigAccount('MSIG')

            await expect(strategy.sign(group, multisigAccount)).rejects.toThrow(
                NoLocalParticipantsError,
            )
        })

        test('passes callbacks to participant strategies', async () => {
            const { strategy, mockParticipantStrategy } = makeStrategy([
                participantA,
            ])
            const group = makeAnalyzedGroup()
            const callbacks = { onSigningStart: vi.fn() }

            await strategy.sign(group, makeMultisigAccount('MSIG'), callbacks)

            expect(mockParticipantStrategy.sign).toHaveBeenCalledWith(
                group,
                participantA,
                callbacks,
            )
        })

        test('lifts each participant per-txn sig into SignerInfo.signatures (base64)', async () => {
            const sigsA = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]
            const sigsB = [new Uint8Array([7, 8, 9]), new Uint8Array([10])]

            const mockParticipantStrategy: SigningStrategy = {
                canSign: () => true,
                sign: vi.fn((_group, account) => {
                    const sigs =
                        account.address === 'PARTICIPANT_A' ? sigsA : sigsB
                    return Promise.resolve(
                        makeSigningResultWithSigs(account.address, sigs),
                    )
                }),
            }

            const strategy = createMultisigStrategy({
                getLocalParticipants: () => [participantA, participantB],
                getStrategyForParticipant: () => mockParticipantStrategy,
                getAllAccounts: () => allAccounts,
            })

            const result = await strategy.sign(
                makeAnalyzedGroup(),
                makeMultisigAccount('MSIG'),
            )

            expect(result.signers).toHaveLength(2)
            expect(result.signers[0]).toEqual({
                address: 'PARTICIPANT_A',
                signatures: ['AQID', 'BAUG'],
            })
            expect(result.signers[1]).toEqual({
                address: 'PARTICIPANT_B',
                signatures: ['BwgJ', 'Cg=='],
            })
        })

        test('signatures entry is null for txns the participant did not sign', async () => {
            const partial: SigningResult = {
                signedData: {
                    type: 'transactions',
                    signed: [
                        { sig: new Uint8Array([1]) } as any,
                        {} as any, // no sig, no msig
                    ],
                },
                signers: [{ address: 'PARTICIPANT_A' }],
            }
            const mockParticipantStrategy: SigningStrategy = {
                canSign: () => true,
                sign: vi.fn(() => Promise.resolve(partial)),
            }

            const strategy = createMultisigStrategy({
                getLocalParticipants: () => [participantA],
                getStrategyForParticipant: () => mockParticipantStrategy,
                getAllAccounts: () => allAccounts,
            })

            const result = await strategy.sign(
                makeAnalyzedGroup(),
                makeMultisigAccount('MSIG'),
            )

            expect(result.signers[0].signatures).toEqual(['AQ==', null])
        })

        test('falls back to msig.subsig sig when sig is absent', async () => {
            const subsigSig = new Uint8Array([42, 43, 44])
            const msigShaped: SigningResult = {
                signedData: {
                    type: 'transactions',
                    signed: [
                        {
                            msig: {
                                v: 1,
                                thr: 2,
                                subsig: [
                                    { pk: new Uint8Array([0]) },
                                    {
                                        pk: new Uint8Array([1]),
                                        s: subsigSig,
                                    },
                                ],
                            },
                        } as any,
                    ],
                },
                signers: [{ address: 'PARTICIPANT_A' }],
            }
            const mockParticipantStrategy: SigningStrategy = {
                canSign: () => true,
                sign: vi.fn(() => Promise.resolve(msigShaped)),
            }

            const strategy = createMultisigStrategy({
                getLocalParticipants: () => [participantA],
                getStrategyForParticipant: () => mockParticipantStrategy,
                getAllAccounts: () => allAccounts,
            })

            const result = await strategy.sign(
                makeAnalyzedGroup(),
                makeMultisigAccount('MSIG'),
            )

            expect(result.signers[0].signatures).toEqual(['Kiss'])
        })
    })
})

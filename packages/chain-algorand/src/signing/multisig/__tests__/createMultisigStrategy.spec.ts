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

import { describe, test, expect, vi } from 'vitest'
import '../../../__tests__/registerAlgorandAccounts'
import { SignedTransaction as AlgosdkSignedTransaction } from 'algosdk'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    NoLocalParticipantsError,
    type SigningStrategy,
    type SigningResult,
    type AnalyzedSignableGroup,
} from '@perawallet/wallet-core-signing'
import { createMultisigStrategy } from '../createMultisigStrategy'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'
import { algorandAddressOf } from '../../../accounts/vocabulary'
import { encodeSignedTransaction } from '../../../blockchain/utils/transact'
import {
    MAINNET_GENESIS_HASH,
    makeTestAddress,
    makeTestPaymentTx,
    signedAlgorandTransaction,
    testSignature,
} from '../../__tests__/transactions'

const TXN = makeTestPaymentTx(makeTestAddress(1), {
    receiver: makeTestAddress(2),
    genesisHash: MAINNET_GENESIS_HASH,
})

const makeMultisigAccount = (address: string): WalletAccount =>
    ({
        custody: { kind: 'multisig' },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address,
                native: {
                    family: 'algorand',
                    multisig: {
                        version: 1,
                        threshold: 2,
                        addresses: ['PARTICIPANT_A', 'PARTICIPANT_B'],
                    },
                },
            },
        },
    }) as any

const makeAlgo25Account = (address: string): WalletAccount =>
    ({
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address,
                keyPairId: 'key-1',
            },
        },
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
        signed: sigs.map(sig => signedAlgorandTransaction(TXN, sig)),
    },
    signers: [{ address }],
})

const makeAnalyzedGroup = (): AnalyzedSignableGroup =>
    ({
        source: { type: 'walletConnect' },
        data: {
            type: 'transactions',
            transactions: [],
            chainData: { algorand: { indicesToSign: [] } },
        },
        analysis: {
            totalFees: 0n,
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
                Promise.resolve(makeSigningResult(algorandAddressOf(account)!)),
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
            const sigsA = [testSignature(1), testSignature(2)]
            const sigsB = [testSignature(3), testSignature(4)]

            const mockParticipantStrategy: SigningStrategy = {
                canSign: () => true,
                sign: vi.fn((_group, account) => {
                    const sigs =
                        algorandAddressOf(account) === 'PARTICIPANT_A'
                            ? sigsA
                            : sigsB
                    return Promise.resolve(
                        makeSigningResultWithSigs(
                            algorandAddressOf(account)!,
                            sigs,
                        ),
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
                signatures: sigsA.map(encodeToBase64),
            })
            expect(result.signers[1]).toEqual({
                address: 'PARTICIPANT_B',
                signatures: sigsB.map(encodeToBase64),
            })
        })

        test('signatures entry is null for txns the participant did not sign', async () => {
            const partial: SigningResult = {
                signedData: {
                    type: 'transactions',
                    signed: [
                        signedAlgorandTransaction(TXN, testSignature(1)),
                        signedAlgorandTransaction(TXN), // no sig, no msig
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

            expect(result.signers[0].signatures).toEqual([
                encodeToBase64(testSignature(1)),
                null,
            ])
        })

        test('falls back to msig.subsig sig when sig is absent', async () => {
            const subsigSig = testSignature(42)
            const msigEnvelope = new AlgosdkSignedTransaction({
                txn: TXN,
                msig: {
                    v: 1,
                    thr: 2,
                    subsig: [
                        { pk: new Uint8Array(32).fill(0) },
                        { pk: new Uint8Array(32).fill(1), s: subsigSig },
                    ],
                },
            })
            const msigShaped: SigningResult = {
                signedData: {
                    type: 'transactions',
                    signed: [
                        {
                            scope: {
                                chainId: 'algorand',
                                networkId: 'mainnet',
                            },
                            id: TXN.txID(),
                            bytes: encodeSignedTransaction(msigEnvelope),
                        },
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

            expect(result.signers[0].signatures).toEqual([
                encodeToBase64(subsigSig),
            ])
        })
    })
})

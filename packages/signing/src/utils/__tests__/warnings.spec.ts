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
import { aggregateTransactionWarnings } from '../warnings'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...original,
        encodeAlgorandAddress: vi.fn(
            (bytes: Uint8Array) => `ENCODED_${new TextDecoder().decode(bytes)}`,
        ),
    }
})

const makeTx = (
    overrides: Partial<PeraDisplayableTransaction> = {},
): PeraDisplayableTransaction =>
    ({
        sender: 'ADDR1',
        ...overrides,
    }) as unknown as PeraDisplayableTransaction

describe('aggregateTransactionWarnings', () => {
    const userAccountAddresses = new Set(['ADDR1', 'ADDR2'])
    const signableAddresses = new Set(['ADDR1', 'ADDR2'])

    test('returns empty array when no warnings', () => {
        const txs = [makeTx()]
        expect(
            aggregateTransactionWarnings(
                txs,
                userAccountAddresses,
                signableAddresses,
            ),
        ).toEqual([])
    })

    test('returns empty array for empty transactions', () => {
        expect(
            aggregateTransactionWarnings(
                [],
                userAccountAddresses,
                signableAddresses,
            ),
        ).toEqual([])
    })

    test('detects close-account warning from payment transaction', () => {
        const txs = [
            makeTx({
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toEqual([
            {
                type: 'close-account',
                senderAddress: 'ADDR1',
                targetAddress: 'CLOSE_ADDR',
            },
        ])
    })

    test('detects close-asset warning from asset transfer transaction', () => {
        const txs = [
            makeTx({
                assetTransferTransaction: {
                    closeTo: 'ASSET_CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toEqual([
            {
                type: 'close-asset',
                senderAddress: 'ADDR1',
                targetAddress: 'ASSET_CLOSE_ADDR',
            },
        ])
    })

    // the two close kinds are separate types so the review sheet can
    // describe them differently — an asset opt-out must not read as "this closes
    // your account". `distinctWarnings` dedupes by type, so collapsing them
    // would also hide one of the two in a group that does both.
    test('keeps account close and asset opt-out as distinct warnings in one group', () => {
        const txs = [
            makeTx({
                paymentTransaction: { closeRemainderTo: 'CLOSE_ADDR' } as any,
            }),
            makeTx({
                assetTransferTransaction: {
                    closeTo: 'ASSET_CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings.map(w => w.type)).toEqual([
            'close-account',
            'close-asset',
        ])
    })

    test('detects rekey warning', () => {
        const txs = [
            makeTx({
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toEqual([
            {
                type: 'rekey',
                senderAddress: 'ADDR1',
                targetAddress: 'ENCODED_REKEY_TARGET',
            },
        ])
    })

    test('skips close, freeze and rekey warnings from non-user addresses', () => {
        const txs = [
            makeTx({
                sender: 'UNKNOWN_ADDR',
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toEqual([])
    })

    test('does not generate rekey warning for non-user addresses', () => {
        const txs = [
            makeTx({
                sender: 'UNKNOWN_ADDR',
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toEqual([])
    })

    test('flags close but not rekey for a user account that is not signable', () => {
        // WATCH_ADDR is in the wallet (close/freeze relevant) but cannot be
        // signed for (watch-only / no local multisig participant / rekeyed
        // out), so it must NOT produce a rekey warning.
        const txs = [
            makeTx({
                sender: 'WATCH_ADDR',
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            new Set(['WATCH_ADDR']),
            new Set(),
        )
        expect(warnings).toEqual([
            {
                type: 'close-account',
                senderAddress: 'WATCH_ADDR',
                targetAddress: 'CLOSE_ADDR',
            },
        ])
    })

    test('skips transactions with no sender', () => {
        const txs = [
            makeTx({
                sender: undefined as any,
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toEqual([])
    })

    test('detects multiple warnings from multiple transactions', () => {
        const txs = [
            makeTx({
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
            }),
            makeTx({
                sender: 'ADDR2',
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toHaveLength(2)
        expect(warnings[0].type).toBe('close-account')
        expect(warnings[1].type).toBe('rekey')
    })

    test('detects both close-account and rekey on same transaction', () => {
        const txs = [
            makeTx({
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toHaveLength(2)
        expect(warnings[0].type).toBe('close-account')
        expect(warnings[1].type).toBe('rekey')
    })

    test('detects asset-freeze warning', () => {
        const txs = [
            makeTx({
                assetFreezeTransaction: {
                    address: 'FREEZE_TARGET_ADDR',
                    assetId: 123,
                    newFreezeStatus: true,
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toEqual([
            {
                type: 'asset-freeze',
                senderAddress: 'ADDR1',
                targetAddress: 'FREEZE_TARGET_ADDR',
            },
        ])
    })

    test('detects asset-freeze alongside other warnings', () => {
        const txs = [
            makeTx({
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
                assetFreezeTransaction: {
                    address: 'FREEZE_TARGET_ADDR',
                    assetId: 123,
                    newFreezeStatus: true,
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(
            txs,
            userAccountAddresses,
            signableAddresses,
        )
        expect(warnings).toHaveLength(2)
        expect(warnings[0].type).toBe('asset-freeze')
        expect(warnings[1].type).toBe('rekey')
    })

    // gating must follow the authorizing entity (the dApp-supplied
    // ARC-0001 signer override), not tx.sender. Otherwise a dApp can suppress
    // the rekey/close warning — and the blocking security gate it drives — by
    // setting a foreign sender it cannot import while signing with an account
    // the wallet holds.
    describe('authorizerByIndex (signer-override gating)', () => {
        test('flags a rekey when the authorizer is signable even though the sender is not in the wallet', () => {
            // Attack: sender E is rekeyed-to-O on-chain but never imported.
            // dApp signs with O (signable) → the wallet authorizes the rekey,
            // so the warning must fire and still name E as the account rekeyed.
            const txs = [
                makeTx({
                    sender: 'FOREIGN_E',
                    rekeyTo: {
                        publicKey: new TextEncoder().encode('ATTACKER'),
                    } as any,
                }),
            ]

            const warnings = aggregateTransactionWarnings(
                txs,
                new Set(['ADDR_O']),
                new Set(['ADDR_O']),
                new Map([[0, 'ADDR_O']]),
            )

            expect(warnings).toEqual([
                {
                    type: 'rekey',
                    senderAddress: 'FOREIGN_E',
                    targetAddress: 'ENCODED_ATTACKER',
                },
            ])
        })

        test('flags a close-account when the authorizer is owned even though the sender is not in the wallet', () => {
            const txs = [
                makeTx({
                    sender: 'FOREIGN_E',
                    paymentTransaction: {
                        closeRemainderTo: 'ATTACKER',
                    } as any,
                }),
            ]

            const warnings = aggregateTransactionWarnings(
                txs,
                new Set(['ADDR_O']),
                new Set(['ADDR_O']),
                new Map([[0, 'ADDR_O']]),
            )

            expect(warnings).toEqual([
                {
                    type: 'close-account',
                    senderAddress: 'FOREIGN_E',
                    targetAddress: 'ATTACKER',
                },
            ])
        })

        test('does not flag when the authorizer override is not in the wallet', () => {
            const txs = [
                makeTx({
                    sender: 'ADDR1',
                    rekeyTo: {
                        publicKey: new TextEncoder().encode('ATTACKER'),
                    } as any,
                }),
            ]

            // Override points the authority at a foreign account: the wallet
            // would not produce a usable signature, so no warning/gate.
            const warnings = aggregateTransactionWarnings(
                txs,
                userAccountAddresses,
                signableAddresses,
                new Map([[0, 'FOREIGN_AUTH']]),
            )

            expect(warnings).toEqual([])
        })

        test('falls back to sender when no override is present for an index', () => {
            const txs = [
                makeTx({
                    sender: 'ADDR1',
                    rekeyTo: {
                        publicKey: new TextEncoder().encode('REKEY_TARGET'),
                    } as any,
                }),
            ]

            // Empty override map → sender-based gating (no regression).
            const warnings = aggregateTransactionWarnings(
                txs,
                userAccountAddresses,
                signableAddresses,
                new Map(),
            )

            expect(warnings).toEqual([
                {
                    type: 'rekey',
                    senderAddress: 'ADDR1',
                    targetAddress: 'ENCODED_REKEY_TARGET',
                },
            ])
        })

        test('applies overrides per index across multiple transactions', () => {
            const txs = [
                // index 0: foreign sender, no override → skipped
                makeTx({
                    sender: 'FOREIGN_X',
                    rekeyTo: {
                        publicKey: new TextEncoder().encode('TARGET_0'),
                    } as any,
                }),
                // index 1: foreign sender, override to signable O → flagged
                makeTx({
                    sender: 'FOREIGN_E',
                    rekeyTo: {
                        publicKey: new TextEncoder().encode('TARGET_1'),
                    } as any,
                }),
            ]

            const warnings = aggregateTransactionWarnings(
                txs,
                new Set(['ADDR_O']),
                new Set(['ADDR_O']),
                new Map([[1, 'ADDR_O']]),
            )

            expect(warnings).toEqual([
                {
                    type: 'rekey',
                    senderAddress: 'FOREIGN_E',
                    targetAddress: 'ENCODED_TARGET_1',
                },
            ])
        })
    })
})

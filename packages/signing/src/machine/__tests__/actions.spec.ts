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

import { describe, it, expect } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    PeraSignedTransaction,
    QuantumSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { SignableGroup } from '../../pipeline/types'
import { SigningError } from '../../pipeline/errors'
import {
    assertNoQuantumSignedTransactions,
    buildGroupSignerTypeMap,
} from '../actions'

const PARTICIPANT = 'PARTICIPANT'
const AUTH = 'AUTH'

const algo25 = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        type: 'algo25',
        address,
        keyPairId: `kp-${address}`,
        rekeyAddress,
    }) as unknown as WalletAccount

const hardware = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        type: 'hardware',
        address,
        rekeyAddress,
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'dev-1',
            deviceName: 'Ledger Nano X',
            accountIndex: 0,
            transportType: 'ble',
        },
    }) as unknown as WalletAccount

const watch = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        type: 'watch',
        address,
        rekeyAddress,
    }) as unknown as WalletAccount

const multisig = (address: string, addresses: string[] = []): WalletAccount =>
    ({
        type: 'multisig',
        address,
        multisigDetails: { threshold: 1, addresses, version: 1 },
    }) as unknown as WalletAccount

const quantum = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        type: 'quantum',
        address,
        keyPairId: `kp-${address}`,
        rekeyAddress,
    }) as unknown as WalletAccount

const buildGroup = (
    overrides: Partial<SignableGroup> & Pick<SignableGroup, 'source'>,
): SignableGroup => ({
    data: {
        type: 'transactions',
        transactions: [],
        indicesToSign: [],
    },
    signerAddress: PARTICIPANT,
    ...overrides,
})

describe('buildGroupSignerTypeMap', () => {
    describe('multisig-cosign groups (rekey MUST be bypassed)', () => {
        it('classifies a local-key participant rekeyed to hardware as localKey (uses participant own type)', () => {
            const participant = algo25(PARTICIPANT, AUTH)
            const auth = hardware(AUTH)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            const map = buildGroupSignerTypeMap([group], [participant, auth])

            expect(map.get(PARTICIPANT)).toBe('localKey')
        })

        it('classifies a hardware participant rekeyed to local-key as hardware (uses participant own type)', () => {
            const participant = hardware(PARTICIPANT, AUTH)
            const auth = algo25(AUTH)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            const map = buildGroupSignerTypeMap([group], [participant, auth])

            expect(map.get(PARTICIPANT)).toBe('hardware')
        })

        it('classifies a non-rekeyed local-key participant as localKey', () => {
            const participant = algo25(PARTICIPANT)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            const map = buildGroupSignerTypeMap([group], [participant])

            expect(map.get(PARTICIPANT)).toBe('localKey')
        })

        it('classifies a non-rekeyed hardware participant as hardware', () => {
            const participant = hardware(PARTICIPANT)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            const map = buildGroupSignerTypeMap([group], [participant])

            expect(map.get(PARTICIPANT)).toBe('hardware')
        })

        it('throws when a watch-account participant has no own signing capability (rekey is not consulted)', () => {
            const participant = watch(PARTICIPANT, AUTH)
            const auth = algo25(AUTH)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            expect(() =>
                buildGroupSignerTypeMap([group], [participant, auth]),
            ).toThrow(/No signing capability/)
        })
    })

    describe('non-cosign groups (rekey rule still applies)', () => {
        it('classifies a local-key sender rekeyed to hardware as hardware (auth-account rule)', () => {
            const sender = algo25(PARTICIPANT, AUTH)
            const auth = hardware(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('hardware')
        })

        it('classifies a hardware sender rekeyed to local-key as localKey (auth-account rule)', () => {
            const sender = hardware(PARTICIPANT, AUTH)
            const auth = algo25(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('localKey')
        })

        it('classifies a multisig sender rekeyed to another multisig as multisig', () => {
            const sender = multisig(PARTICIPANT, ['P1', 'P2'])
            sender.rekeyAddress = AUTH
            const auth = multisig(AUTH, ['P1', 'P2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('multisig')
        })

        it('classifies a local-key sender rekeyed to a multisig auth as multisig (auth-account rule)', () => {
            // Reachable via external rekey or watch-import of an account
            // rekeyed on-chain to a Pera-held multisig — the auth's template
            // authorizes the transaction, so it routes to the propose path.
            const sender = algo25(PARTICIPANT, AUTH)
            const auth = multisig(AUTH, ['P1', 'P2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('multisig')
        })

        it('classifies a watch sender rekeyed to a multisig auth as multisig', () => {
            const sender = watch(PARTICIPANT, AUTH)
            const auth = multisig(AUTH, ['P1', 'P2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('multisig')
        })

        it('classifies a multisig sender externally rekeyed to a local-key auth as localKey (auth-account rule)', () => {
            // msig → standard is unreachable through the in-app rekey UI but
            // can exist on-chain — the auth key signs, so route to it instead
            // of failing with NoLocalParticipantsError.
            const sender = multisig(PARTICIPANT, ['P1', 'P2'])
            sender.rekeyAddress = AUTH
            const auth = algo25(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('localKey')
        })
    })

    describe('quantum classification (PQ-006 / PERA-4488)', () => {
        it('classifies a non-rekeyed quantum sender as quantum', () => {
            // Quantum accounts carry a keyPairId, so the pre-existing
            // hasSigningKeys check would have swallowed them into localKey.
            // The quantum branch must run BEFORE hasSigningKeys.
            const sender = quantum(PARTICIPANT)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender])

            expect(map.get(PARTICIPANT)).toBe('quantum')
        })

        it('classifies a local-key sender rekeyed to a quantum auth as quantum (auth-account rule)', () => {
            const sender = algo25(PARTICIPANT, AUTH)
            const auth = quantum(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('quantum')
        })

        it('classifies a quantum sender rekeyed to a local-key auth as localKey (auth-account rule)', () => {
            const sender = quantum(PARTICIPANT, AUTH)
            const auth = algo25(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender, auth])

            expect(map.get(PARTICIPANT)).toBe('localKey')
        })

        it('classifies a multisig sender as multisig, never quantum, even when it lists quantum participants (regression)', () => {
            // A quantum key can never satisfy a multisig slot (slots verify
            // Ed25519 only), so a multisig account must always route to the
            // multisig strategy — the quantum branch must not intercept it.
            const sender = multisig(PARTICIPANT, ['Q1', 'Q2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerTypeMap([group], [sender])

            expect(map.get(PARTICIPANT)).toBe('multisig')
        })
    })

    describe('mixed batches', () => {
        it('classifies cosign and non-cosign groups independently in one call', () => {
            const cosignParticipant = algo25('A', 'A_AUTH')
            const cosignAuth = hardware('A_AUTH')
            const localSender = algo25('B', 'B_AUTH')
            const localAuth = hardware('B_AUTH')

            const cosignGroup = buildGroup({
                signerAddress: 'A',
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })
            const localGroup = buildGroup({
                signerAddress: 'B',
                source: { type: 'local' },
            })

            const map = buildGroupSignerTypeMap(
                [cosignGroup, localGroup],
                [cosignParticipant, cosignAuth, localSender, localAuth],
            )

            // Same underlying account type, different sources → different
            // classification.
            expect(map.get('A')).toBe('localKey') // participant own type
            expect(map.get('B')).toBe('hardware') // auth account's type
        })

        it('does not duplicate classification work when multiple groups share a signerAddress', () => {
            const participant = algo25(PARTICIPANT)
            const groupA = buildGroup({
                source: { type: 'multisig-cosign', signRequestId: 'sr-1' },
            })
            const groupB = buildGroup({
                source: { type: 'multisig-cosign', signRequestId: 'sr-1' },
            })

            const map = buildGroupSignerTypeMap([groupA, groupB], [participant])

            expect(map.size).toBe(1)
            expect(map.get(PARTICIPANT)).toBe('localKey')
        })
    })

    describe('error paths', () => {
        it('throws CannotSignError when signerAddress is not in allAccounts', () => {
            // Direct call to buildGroupSignerTypeMap with a group whose
            // signerAddress is not in the wallet — verifies the explicit
            // "signer account not found in wallet" branch (the resolveInitialContext
            // path silently skips unknown signers before reaching here).
            const group = buildGroup({
                signerAddress: 'STRANGER',
                source: { type: 'local' },
            })

            expect(() => buildGroupSignerTypeMap([group], [])).toThrow(
                /signer account not found/,
            )
        })
    })
})

describe('assertNoQuantumSignedTransactions', () => {
    const plainSigned = (id: string): PeraSignedTransaction =>
        ({ txn: { sender: id } }) as unknown as PeraSignedTransaction

    const quantumCarrier = (): QuantumSignedTransaction => ({
        txn: { sender: 'Q' } as never,
        pqSignedBytes: new Uint8Array([1, 2, 3]),
    })

    it('returns the same plain signed transactions unchanged when no quantum carrier is present', () => {
        // The callback-approve path (WalletConnect / webview / deeplink /
        // local-callback) hands these straight to an external peer, so the
        // guard must pass them through untouched.
        const signed = [plainSigned('A'), plainSigned('B')]

        const result = assertNoQuantumSignedTransactions(signed)

        expect(result).toBe(signed)
        expect(result).toEqual(signed)
    })

    it('throws a SigningError when a quantum signed-transaction carrier is present', () => {
        // No peer can consume a Falcon pqsig byte carrier via callback
        // delivery yet — fail loudly instead of silently mis-encoding it as
        // a plain signed transaction.
        const signed = [plainSigned('A'), quantumCarrier()]

        expect(() => assertNoQuantumSignedTransactions(signed)).toThrow(
            SigningError,
        )
        expect(() => assertNoQuantumSignedTransactions(signed)).toThrow(
            /quantum/i,
        )
    })
})

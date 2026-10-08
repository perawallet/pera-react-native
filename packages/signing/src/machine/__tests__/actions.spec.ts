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
import '../../__tests__/registerAlgorandAccounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-chain-contract'
import type { SignableGroup } from '../../pipeline/types'
import { buildGroupSignerMap, resolveInitialContext } from '../actions'
import type { SigningMachineInput } from '../context'
import type { TransactionSignRequest } from '../../models'
import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../__tests__/transactions'

const PARTICIPANT = 'PARTICIPANT'
const AUTH = 'AUTH'

const LOCAL = { custody: 'local', scheme: 'ed25519' }
const FALCON = { custody: 'local', scheme: 'falcon-1024' }
const HARDWARE = { custody: 'hardware', scheme: 'ed25519' }
const MULTISIG = { custody: 'multisig', scheme: 'ed25519' }

const algo25 = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        custody: { kind: 'local', seed: 'algo25' },
        address,
        keyPairId: `kp-${address}`,
        rekeyAddress,
    }) as unknown as WalletAccount

const hardware = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'dev-1',
                deviceName: 'Ledger Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
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
        custody: { kind: 'watch' },
        address,
        rekeyAddress,
    }) as unknown as WalletAccount

const multisig = (address: string, addresses: string[] = []): WalletAccount =>
    ({
        custody: { kind: 'multisig' },
        address,
        multisigDetails: { threshold: 1, addresses, version: 1 },
    }) as unknown as WalletAccount

const quantum = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        custody: { kind: 'local', seed: 'quantum' },
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

describe('buildGroupSignerMap', () => {
    describe('multisig-cosign groups (rekey MUST be bypassed)', () => {
        it('classifies a local-key participant rekeyed to hardware as local custody (uses participant own type)', () => {
            const participant = algo25(PARTICIPANT, AUTH)
            const auth = hardware(AUTH)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            const map = buildGroupSignerMap(
                [group],
                [participant, auth],
                'algorand',
            )

            expect(map.get(PARTICIPANT)).toEqual(LOCAL)
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

            const map = buildGroupSignerMap(
                [group],
                [participant, auth],
                'algorand',
            )

            expect(map.get(PARTICIPANT)).toEqual(HARDWARE)
        })

        it('classifies a non-rekeyed local-key participant as local custody', () => {
            const participant = algo25(PARTICIPANT)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            const map = buildGroupSignerMap([group], [participant], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(LOCAL)
        })

        it('classifies a non-rekeyed hardware participant as hardware', () => {
            const participant = hardware(PARTICIPANT)
            const group = buildGroup({
                source: {
                    type: 'multisig-cosign',
                    signRequestId: 'sr-1',
                },
            })

            const map = buildGroupSignerMap([group], [participant], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(HARDWARE)
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
                buildGroupSignerMap([group], [participant, auth], 'algorand'),
            ).toThrow(/No signing capability/)
        })
    })

    describe('non-cosign groups (rekey rule still applies)', () => {
        it('classifies a local-key sender rekeyed to hardware as hardware (auth-account rule)', () => {
            const sender = algo25(PARTICIPANT, AUTH)
            const auth = hardware(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(HARDWARE)
        })

        it('classifies a hardware sender rekeyed to local-key as local custody (auth-account rule)', () => {
            const sender = hardware(PARTICIPANT, AUTH)
            const auth = algo25(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(LOCAL)
        })

        it('classifies a multisig sender rekeyed to another multisig as multisig', () => {
            const sender = multisig(PARTICIPANT, ['P1', 'P2'])
            sender.rekeyAddress = AUTH
            const auth = multisig(AUTH, ['P1', 'P2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(MULTISIG)
        })

        it('classifies a local-key sender rekeyed to a multisig auth as multisig (auth-account rule)', () => {
            // Reachable via external rekey or watch-import of an account
            // rekeyed on-chain to a Pera-held multisig — the auth's template
            // authorizes the transaction, so it routes to the propose path.
            const sender = algo25(PARTICIPANT, AUTH)
            const auth = multisig(AUTH, ['P1', 'P2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(MULTISIG)
        })

        it('classifies a watch sender rekeyed to a multisig auth as multisig', () => {
            const sender = watch(PARTICIPANT, AUTH)
            const auth = multisig(AUTH, ['P1', 'P2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(MULTISIG)
        })

        it('classifies a multisig sender externally rekeyed to a local-key auth as local custody (auth-account rule)', () => {
            // msig → standard is unreachable through the in-app rekey UI but
            // can exist on-chain — the auth key signs, so route to it instead
            // of failing with NoLocalParticipantsError.
            const sender = multisig(PARTICIPANT, ['P1', 'P2'])
            sender.rekeyAddress = AUTH
            const auth = algo25(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(LOCAL)
        })
    })

    describe('quantum classification', () => {
        it('resolves a quantum account to local custody with the Falcon scheme', () => {
            // Same custody as algo25/HD, so the same actor; only the scheme
            // differs, which is why no quantum machine state exists.
            const sender = quantum(PARTICIPANT)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(FALCON)
        })

        it("resolves a local-key sender rekeyed to a quantum auth account to the auth's Falcon scheme", () => {
            const sender = algo25(PARTICIPANT, AUTH)
            const auth = quantum(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(FALCON)
        })

        it("resolves a quantum sender rekeyed to a local-key auth to the auth's Ed25519 scheme", () => {
            const sender = quantum(PARTICIPANT, AUTH)
            const auth = algo25(AUTH)
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender, auth], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(LOCAL)
        })

        it('still classifies a multisig with quantum participants as multisig', () => {
            // A quantum key can never satisfy a multisig slot (slots verify
            // Ed25519 only), so a multisig account must always route to the
            // multisig strategy regardless of its participants' types.
            const sender = multisig(PARTICIPANT, ['Q1', 'Q2'])
            const group = buildGroup({ source: { type: 'local' } })

            const map = buildGroupSignerMap([group], [sender], 'algorand')

            expect(map.get(PARTICIPANT)).toEqual(MULTISIG)
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

            const map = buildGroupSignerMap(
                [cosignGroup, localGroup],
                [cosignParticipant, cosignAuth, localSender, localAuth],
                'algorand',
            )

            // Same underlying account type, different sources → different
            // classification.
            expect(map.get('A')).toEqual(LOCAL) // participant own type
            expect(map.get('B')).toEqual(HARDWARE) // auth account's type
        })

        it('does not duplicate classification work when multiple groups share a signerAddress', () => {
            const participant = algo25(PARTICIPANT)
            const groupA = buildGroup({
                source: { type: 'multisig-cosign', signRequestId: 'sr-1' },
            })
            const groupB = buildGroup({
                source: { type: 'multisig-cosign', signRequestId: 'sr-1' },
            })

            const map = buildGroupSignerMap(
                [groupA, groupB],
                [participant],
                'algorand',
            )

            expect(map.size).toBe(1)
            expect(map.get(PARTICIPANT)).toEqual(LOCAL)
        })
    })

    describe('error paths', () => {
        it('throws CannotSignError when signerAddress is not in allAccounts', () => {
            // Direct call to buildGroupSignerMap with a group whose
            // signerAddress is not in the wallet — verifies the explicit
            // "signer account not found in wallet" branch (the resolveInitialContext
            // path silently skips unknown signers before reaching here).
            const group = buildGroup({
                signerAddress: 'STRANGER',
                source: { type: 'local' },
            })

            expect(() => buildGroupSignerMap([group], [], 'algorand')).toThrow(
                /signer account not found/,
            )
        })
    })
})

describe('quantum-signed transactions over the callback transport', () => {
    // A quantum (post-quantum) signature is just a `PeraSignedTransaction`
    // with `pqsig` set instead of `sig` (deleted the
    // `QuantumSignedTransaction` byte carrier) — so there is nothing
    // carrier-specific left for the callback transport to special-case; a
    // signed array with a pqsig entry forwards exactly like an all-`sig`
    // one.
    const plainSigned = (id: string): PeraSignedTransaction =>
        ({ txn: { sender: id } }) as unknown as PeraSignedTransaction

    const pqSigned = (): PeraSignedTransaction =>
        ({
            txn: { sender: 'Q' },
            pqsig: { sig: new Uint8Array([1, 2, 3]) },
        }) as unknown as PeraSignedTransaction

    const userAddr = makeTestAddress(11)
    const dappAddr = makeTestAddress(12)
    const userAccount = {
        custody: { kind: 'local', seed: 'algo25' },
        address: userAddr.toString(),
        keyPairId: 'key-quantum-cb',
    } as unknown as WalletAccount

    const baseInput = (request: TransactionSignRequest): SigningMachineInput =>
        ({
            request,
            allAccounts: [userAccount],
            signTransactions: vi.fn(),
            signArbitraryData: vi.fn(),
            signAuthData: vi.fn(),
            createTransport: vi.fn(),
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            encodeTransaction: vi.fn(),
        }) as unknown as SigningMachineInput

    it('forwards a mixed signed array containing a pqsig-signed transaction to the approve callback unchanged', async () => {
        const txApprove = vi.fn(async () => undefined)
        const request: TransactionSignRequest = {
            id: 'req-quantum-cb',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: [
                makeTestPaymentTx(userAddr, {
                    receiver: dappAddr,
                    amount: 1n,
                }),
            ],
            approve: txApprove,
        }

        const context = resolveInitialContext(baseInput(request))
        const { callbacks } = context.signableGroups![0].source

        const signed: PeraSignedTransaction[] = [plainSigned('A'), pqSigned()]

        await callbacks?.approve?.({
            signedData: { type: 'transactions', signed },
            signers: [{ address: userAccount.address }],
        } as never)

        expect(txApprove).toHaveBeenCalledWith(signed)
    })
})

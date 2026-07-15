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

// Hardware-participant signing reaches into `Address.fromString` for rekey
// detection. The fixture addresses below are not canonical 58-char Algorand
// addresses, so stub it the same way createHardwareStrategy.spec.ts does.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-blockchain')
    return {
        ...actual,
        Address: {
            fromString: (addr: string) => ({ address: addr }),
        },
    }
})

import { multisigSignerActor } from '../multisigSignerActor'
import type { MultisigSignerActorInput } from '../multisigSignerActor'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    createHardwareWalletRegistry,
    type HardwareWalletTransport,
    type HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    CannotSignError,
    NoLocalParticipantsError,
} from '../../../../pipeline/errors'

const MULTISIG_ADDRESS =
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM'
const PARTICIPANT_A =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const PARTICIPANT_B =
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const makeMultisigAccount = (): WalletAccount =>
    ({
        type: 'multisig',
        address: MULTISIG_ADDRESS,
        multisigDetails: {
            version: 1,
            threshold: 2,
            addresses: [PARTICIPANT_A, PARTICIPANT_B],
        },
    }) as unknown as WalletAccount

const makeAlgo25Account = (address: string, keyPairId = 'key'): WalletAccount =>
    ({ type: 'algo25', address, keyPairId }) as unknown as WalletAccount

const MOCK_HARDWARE_SIG = new Uint8Array([0xab, 0xcd, 0xef])

const makeMockTransport = (address: string): HardwareWalletTransport => ({
    getAddress: vi.fn().mockResolvedValue({
        address,
        publicKey: new Uint8Array(32),
        accountIndex: 0,
    }),
    signTransaction: vi.fn().mockResolvedValue(MOCK_HARDWARE_SIG),
    disconnect: vi.fn().mockResolvedValue(undefined),
})

const makeMockRegistry = (transport: HardwareWalletTransport) => {
    const provider: HardwareWalletTransportProvider = {
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: vi.fn().mockResolvedValue(transport),
        isSupported: vi.fn().mockResolvedValue(true),
    }
    const registry = createHardwareWalletRegistry()
    registry.register(provider)
    return registry
}

const mockTxn = { txn: {} } as never
const mockGroup = (
    signerAddress: string = MULTISIG_ADDRESS,
): AnalyzedSignableGroup => ({
    data: {
        type: 'transactions',
        transactions: [mockTxn],
        indicesToSign: [0],
    },
    source: { type: 'local' },
    signerAddress,
    analysis: {
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low',
    },
})

const buildInput = (
    overrides: Partial<MultisigSignerActorInput> = {},
): MultisigSignerActorInput => ({
    groups: [mockGroup()],
    allAccounts: [
        makeMultisigAccount(),
        makeAlgo25Account(PARTICIPANT_A, 'key-a'),
        makeAlgo25Account(PARTICIPANT_B, 'key-b'),
    ],
    signTransactions: vi
        .fn()
        .mockResolvedValue([{ txn: {}, sig: new Uint8Array([1, 2, 3]) }]),
    signArbitraryData: vi.fn(),
    signArc60: vi.fn(),
    encodeTransaction: vi.fn(),
    ...overrides,
})

describe('multisigSignerActor', () => {
    it('signs in parallel with all local-key participants and returns one combined SigningResult per group', async () => {
        const signTransactions = vi
            .fn()
            .mockResolvedValueOnce([{ txn: {}, sig: new Uint8Array([1]) }])
            .mockResolvedValueOnce([{ txn: {}, sig: new Uint8Array([2]) }])
        const input = buildInput({ signTransactions })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results).toHaveLength(1)
        const [result] = results
        expect(result.signers).toHaveLength(2)
        expect(result.signers.map(s => s.address).sort()).toEqual([
            PARTICIPANT_A,
            PARTICIPANT_B,
        ])
        for (const signer of result.signers) {
            expect(signer.signatures).toHaveLength(1)
            expect(typeof signer.signatures?.[0]).toBe('string')
        }
        expect(signTransactions).toHaveBeenCalledTimes(2)
    })

    it('signs successfully with a single local-key participant', async () => {
        const signTransactions = vi
            .fn()
            .mockResolvedValue([{ txn: {}, sig: new Uint8Array([42]) }])
        const input = buildInput({
            allAccounts: [
                makeMultisigAccount(),
                makeAlgo25Account(PARTICIPANT_A),
                // PARTICIPANT_B not in wallet
            ],
            signTransactions,
        })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results[0].signers).toHaveLength(1)
        expect(results[0].signers[0].address).toBe(PARTICIPANT_A)
        expect(signTransactions).toHaveBeenCalledTimes(1)
    })

    it('throws NoLocalParticipantsError when wallet has no signing-capable participants', async () => {
        const input = buildInput({
            allAccounts: [makeMultisigAccount()], // multisig account only, no participants
            signTransactions: vi.fn(),
        })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toBeInstanceOf(
            NoLocalParticipantsError,
        )
    })

    it('throws CannotSignError when group signerAddress is missing from allAccounts', async () => {
        const input = buildInput({
            allAccounts: [
                makeAlgo25Account(PARTICIPANT_A),
                makeAlgo25Account(PARTICIPANT_B),
                // multisig account itself is missing
            ],
        })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toBeInstanceOf(CannotSignError)
    })

    it('propagates errors from participant signing', async () => {
        const signTransactions = vi
            .fn()
            .mockRejectedValue(new Error('KMS unavailable'))
        const input = buildInput({ signTransactions })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow('KMS unavailable')
    })

    it('produces one SigningResult per group when multiple groups are signed', async () => {
        const otherMultisig =
            'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN'
        const otherParticipant =
            'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'

        const allAccounts: WalletAccount[] = [
            makeMultisigAccount(),
            makeAlgo25Account(PARTICIPANT_A),
            makeAlgo25Account(PARTICIPANT_B),
            {
                type: 'multisig',
                address: otherMultisig,
                multisigDetails: {
                    version: 1,
                    threshold: 1,
                    addresses: [otherParticipant],
                },
            } as unknown as WalletAccount,
            makeAlgo25Account(otherParticipant),
        ]

        const input = buildInput({
            groups: [mockGroup(MULTISIG_ADDRESS), mockGroup(otherMultisig)],
            allAccounts,
            signTransactions: vi
                .fn()
                .mockResolvedValue([{ txn: {}, sig: new Uint8Array([7]) }]),
        })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results).toHaveLength(2)
        // First group has both PARTICIPANT_A and PARTICIPANT_B signing
        expect(results[0].signers).toHaveLength(2)
        // Second group has only otherParticipant signing
        expect(results[1].signers).toHaveLength(1)
        expect(results[1].signers[0].address).toBe(otherParticipant)
    })

    it('skips hardware participants during propose when a local-key participant is available — Ledger prompt is deferred to per-row Sign in the pending sheet', async () => {
        const ledgerParticipant = {
            type: 'hardware',
            address: PARTICIPANT_B,
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as unknown as WalletAccount

        const transport = makeMockTransport(PARTICIPANT_B)
        const hardwareWalletRegistry = makeMockRegistry(transport)
        const encodeTransaction = vi
            .fn()
            .mockReturnValue(new Uint8Array([0x01]))
        const signTransactions = vi
            .fn()
            .mockResolvedValue([{ txn: {}, sig: new Uint8Array([0x42]) }])

        const hardwareReadyGroup: AnalyzedSignableGroup = {
            ...mockGroup(),
            data: {
                type: 'transactions',
                transactions: [
                    { sender: { toString: () => MULTISIG_ADDRESS } } as never,
                ],
                indicesToSign: [0],
            },
        }

        const input = buildInput({
            groups: [hardwareReadyGroup],
            allAccounts: [
                makeMultisigAccount(),
                makeAlgo25Account(PARTICIPANT_A),
                ledgerParticipant,
            ],
            signTransactions,
            encodeTransaction,
            hardwareWalletRegistry,
        })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        // Only PARTICIPANT_A (local-key) signs the propose. The Ledger
        // transport must NOT be invoked — the user signs the hardware slot
        // explicitly via the per-row Sign button after propose completes.
        expect(results[0].signers).toHaveLength(1)
        expect(results[0].signers[0].address).toBe(PARTICIPANT_A)
        expect(signTransactions).toHaveBeenCalledTimes(1)
        expect(transport.signTransaction).not.toHaveBeenCalled()
    })

    it('short-circuits to an empty-signers deferred result when only hardware participants exist — propose call is deferred to the per-row Sign in the pending sheet', async () => {
        const ledgerParticipant = {
            type: 'hardware',
            address: PARTICIPANT_A,
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as unknown as WalletAccount

        const transport = makeMockTransport(PARTICIPANT_A)
        const hardwareWalletRegistry = makeMockRegistry(transport)
        const encodeTransaction = vi
            .fn()
            .mockReturnValue(new Uint8Array([0x01]))
        const signTransactions = vi.fn()

        const hardwareReadyGroup: AnalyzedSignableGroup = {
            ...mockGroup(),
            data: {
                type: 'transactions',
                transactions: [
                    { sender: { toString: () => MULTISIG_ADDRESS } } as never,
                ],
                indicesToSign: [0],
            },
        }

        const input = buildInput({
            groups: [hardwareReadyGroup],
            allAccounts: [makeMultisigAccount(), ledgerParticipant],
            signTransactions,
            encodeTransaction,
            hardwareWalletRegistry,
        })

        const actor = createActor(multisigSignerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        // Empty signers is the defer signal the propose transport uses to
        // create a local draft instead of calling the backend. The raw
        // transaction is carried in signedData.signed so the transport can
        // encode it for the draft.
        expect(results[0].signers).toEqual([])
        expect(results[0].signedData.type).toBe('transactions')
        expect(signTransactions).not.toHaveBeenCalled()
        expect(transport.signTransaction).not.toHaveBeenCalled()
    })
})

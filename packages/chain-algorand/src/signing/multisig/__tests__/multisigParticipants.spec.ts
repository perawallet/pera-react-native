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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../../../__tests__/registerAlgorandAccounts'
import type { AnalyzedSignableGroup } from '@perawallet/wallet-core-signing'
import { makeUnsignedAlgorandTransaction } from '../../__tests__/transactions'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'

const mocks = vi.hoisted(() => ({
    isMultisigAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        isMultisigAccount: mocks.isMultisigAccount,
    }
})

import {
    buildDeferredProposeSigningResult,
    getLocalParticipants,
    getProposeParticipants,
} from '../multisigParticipants'
import { algorandAddressOf } from '../../../accounts/vocabulary'

const makeMultisig = (threshold: number, addresses: string[]): WalletAccount =>
    ({
        custody: { kind: 'multisig' },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: 'MSIG',
                native: {
                    family: 'algorand',
                    multisig: { version: 1, threshold, addresses },
                },
            },
        },
    }) as unknown as WalletAccount

const makeAccount = (address: string): WalletAccount =>
    ({
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address,
                keyPairId: `key-${address}`,
            },
        },
    }) as unknown as WalletAccount

const makeQuantumAccount = (address: string): WalletAccount =>
    ({
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address,
                keyPairId: `key-${address}`,
            },
        },
    }) as unknown as WalletAccount

const makeWatchAccount = (address: string): WalletAccount =>
    ({
        custody: { kind: 'watch' },
        chains: { [ALGORAND_CHAIN_ID]: { address } },
    }) as unknown as WalletAccount

// No keyPairId: the device holds the key.
const makeHardwareAccount = (address: string): WalletAccount =>
    ({
        custody: {
            kind: 'hardware',
            device: { manufacturer: 'ledger', deviceId: 'd', deviceName: 'n' },
            accountIndex: 0,
        },
        chains: { [ALGORAND_CHAIN_ID]: { address } },
    }) as unknown as WalletAccount

const accountA = makeAccount('A')
const accountB = makeAccount('B')
const accountC = makeAccount('C')

beforeEach(() => {
    mocks.isMultisigAccount.mockReset()
})

describe('getLocalParticipants', () => {
    test('returns empty when account is not multisig', () => {
        mocks.isMultisigAccount.mockReturnValue(false)
        expect(getLocalParticipants(accountA, [accountA, accountB])).toEqual([])
    })

    test('returns local accounts that are participants and have own signing keys', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B', 'X'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            accountB,
            accountC,
        ])

        expect(participants).toEqual([accountA, accountB])
    })

    test('filters out participants without own signing keys (rekey indirection NOT followed)', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // Only A has its own keys; B is e.g. a watch participant rekeyed to a
        // local-key account — that does NOT make B able to sign for the
        // multisig slot, because the slot is keyed by B's original pubkey.
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            makeWatchAccount('B'),
        ])

        expect(participants).toEqual([accountA])
    })

    test('includes hardware-wallet participants', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // Hardware accounts have no keyPairId; they stay so the propose flow
        // can route them to hardwareStrategy.
        const ledgerB = makeHardwareAccount('B')
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getLocalParticipants(multisig, [accountA, ledgerB])

        expect(participants).toEqual([accountA, ledgerB])
    })

    test('filters out participants that are neither local-key nor hardware (e.g. watch accounts)', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            makeWatchAccount('B'),
        ])

        expect(participants).toEqual([accountA])
    })

    test('excludes quantum accounts from multisig participants, matching canSignViaParticipants', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // Quantum has a keyPairId (hasSigningKeys would say yes), but multisig
        // slots verify Ed25519 only and algosdk's PQ signer refuses multisig
        // signing outright.
        const quantumAccount = makeQuantumAccount('Q')
        const multisig = makeMultisig(2, ['Q', 'A'])

        const participants = getLocalParticipants(multisig, [
            quantumAccount,
            accountA,
        ])

        expect(participants.map(algorandAddressOf)).toEqual(['A'])
    })

    test('returns participants in participant-list order, not wallet order', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // Multisig participants are [B, A]; wallet stores them as [A, B].
        // Result must follow participant-list order so the proposer pick
        // (signers[0]) is stable across devices regardless of wallet sort.
        const multisig = makeMultisig(2, ['B', 'A'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountB, accountA])
    })
})

describe('getProposeParticipants', () => {
    test('returns only local-key participants when local-key and hardware are both present (Ledger deferred to per-row Sign)', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getProposeParticipants(multisig, [
            accountA,
            makeHardwareAccount('B'),
        ])

        expect(participants).toEqual([accountA])
    })

    test('falls back to hardware participants when the user has no local-key participant (propose still needs ≥1 sig)', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const ledgerA = makeHardwareAccount('A')
        const ledgerB = makeHardwareAccount('B')
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getProposeParticipants(multisig, [
            ledgerA,
            ledgerB,
        ])

        expect(participants).toEqual([ledgerA, ledgerB])
    })

    test('returns empty when the user has no local participation in the multisig at all', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])

        expect(
            getProposeParticipants(multisig, [
                makeWatchAccount('A'),
                makeWatchAccount('B'),
            ]),
        ).toEqual([])
    })

    test('returns local-key participants in participant-list order', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // Multisig participants are [B, A]; both local-key.
        const multisig = makeMultisig(2, ['B', 'A'])

        const participants = getProposeParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountB, accountA])
    })
})

describe('buildDeferredProposeSigningResult', () => {
    test('refuses chain-neutral transactions', () => {
        const group = {
            data: {
                type: 'transactions',
                transactions: [makeUnsignedAlgorandTransaction()],
                chainData: {},
            },
            source: { type: 'local' },
            signerAddress: 'ADDR',
        } as unknown as AnalyzedSignableGroup

        expect(() => buildDeferredProposeSigningResult(group)).toThrow(
            'only supported for Algorand transaction',
        )
    })
})

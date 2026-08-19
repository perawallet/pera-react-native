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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    isMultisigAccount: vi.fn(),
    hasSigningKeys: vi.fn(),
    isHardwareWalletAccount: vi.fn(),
    isQuantumAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        isMultisigAccount: mocks.isMultisigAccount,
        hasSigningKeys: mocks.hasSigningKeys,
        isHardwareWalletAccount: mocks.isHardwareWalletAccount,
        isQuantumAccount: mocks.isQuantumAccount,
    }
})

import {
    getLocalParticipants,
    getProposeParticipants,
    canMeetThresholdLocally,
    getSignaturesNeeded,
} from '../utils'

const makeMultisig = (threshold: number, addresses: string[]): WalletAccount =>
    ({
        type: 'multisig',
        address: 'MSIG',
        multisigDetails: { version: 1, threshold, addresses },
    }) as unknown as WalletAccount

const makeAccount = (address: string): WalletAccount =>
    ({
        type: 'algo25',
        address,
        keyPairId: `key-${address}`,
    }) as unknown as WalletAccount

const makeQuantumAccount = (address: string): WalletAccount =>
    ({
        type: 'quantum',
        address,
        keyPairId: `key-${address}`,
    }) as unknown as WalletAccount

const accountA = makeAccount('A')
const accountB = makeAccount('B')
const accountC = makeAccount('C')

beforeEach(() => {
    mocks.isMultisigAccount.mockReset()
    mocks.hasSigningKeys.mockReset().mockReturnValue(true)
    mocks.isHardwareWalletAccount.mockReset().mockReturnValue(false)
    mocks.isQuantumAccount
        .mockReset()
        .mockImplementation((acc: WalletAccount) => acc.type === 'quantum')
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
        mocks.hasSigningKeys.mockImplementation(
            (acc: WalletAccount) => acc.address === 'A',
        )
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountA])
    })

    test('includes hardware-wallet participants', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // Hardware accounts have no keyPairId, so hasSigningKeys is false for
        // them. The util must keep them anyway via the isHardwareWalletAccount
        // branch so the propose flow can route them to hardwareStrategy.
        mocks.hasSigningKeys.mockImplementation(
            (acc: WalletAccount) => acc.address !== 'B',
        )
        mocks.isHardwareWalletAccount.mockImplementation(
            (acc: WalletAccount) => acc.address === 'B',
        )
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountA, accountB])
    })

    test('filters out participants that are neither local-key nor hardware (e.g. watch accounts)', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // B has no keys (watch) AND is not hardware — must be dropped.
        mocks.hasSigningKeys.mockImplementation(
            (acc: WalletAccount) => acc.address === 'A',
        )
        mocks.isHardwareWalletAccount.mockReturnValue(false)
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountA])
    })

    test('excludes quantum accounts from multisig participants, matching canSignViaParticipants', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        // Quantum has a keyPairId (hasSigningKeys would say yes), but multisig
        // slots verify Ed25519 only and algosdk's PQ signer refuses multisig
        // signing outright — so it must still be excluded here, agreeing with
        // canSignViaParticipants in packages/accounts/src/utils.ts.
        const quantumAccount = makeQuantumAccount('Q')
        const multisig = makeMultisig(2, ['Q', 'A'])

        const participants = getLocalParticipants(multisig, [
            quantumAccount,
            accountA,
        ])

        expect(participants.map(p => p.address)).toEqual([accountA.address])
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
        mocks.hasSigningKeys.mockImplementation(
            (acc: WalletAccount) => acc.address === 'A',
        )
        mocks.isHardwareWalletAccount.mockImplementation(
            (acc: WalletAccount) => acc.address === 'B',
        )
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getProposeParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountA])
    })

    test('falls back to hardware participants when the user has no local-key participant (propose still needs ≥1 sig)', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        mocks.hasSigningKeys.mockReturnValue(false)
        mocks.isHardwareWalletAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getProposeParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountA, accountB])
    })

    test('returns empty when the user has no local participation in the multisig at all', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        mocks.hasSigningKeys.mockReturnValue(false)
        mocks.isHardwareWalletAccount.mockReturnValue(false)
        const multisig = makeMultisig(2, ['A', 'B'])

        expect(getProposeParticipants(multisig, [accountA, accountB])).toEqual(
            [],
        )
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

describe('canMeetThresholdLocally', () => {
    test('returns false when account is not multisig', () => {
        mocks.isMultisigAccount.mockReturnValue(false)
        expect(canMeetThresholdLocally(accountA, [accountA])).toBe(false)
    })

    test('returns true when local participants >= threshold', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])

        expect(canMeetThresholdLocally(multisig, [accountA, accountB])).toBe(
            true,
        )
    })

    test('returns false when local participants < threshold', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(3, ['A', 'B'])

        expect(canMeetThresholdLocally(multisig, [accountA, accountB])).toBe(
            false,
        )
    })

    test('resolves a rekey hop — source rekeyed to a multisig answers via the auth multisig', () => {
        mocks.isMultisigAccount.mockImplementation(
            (acc: WalletAccount) => acc.type === 'multisig',
        )
        const multisig = makeMultisig(2, ['A', 'B'])
        const rekeyedSource = {
            type: 'algo25',
            address: 'SRC',
            keyPairId: 'k',
            rekeyAddress: 'MSIG',
        } as unknown as WalletAccount

        expect(
            canMeetThresholdLocally(rekeyedSource, [
                rekeyedSource,
                multisig,
                accountA,
                accountB,
            ]),
        ).toBe(true)
    })

    test('returns false when rekey target is missing locally', () => {
        const stranded = {
            type: 'algo25',
            address: 'SRC',
            keyPairId: 'k',
            rekeyAddress: 'MISSING',
        } as unknown as WalletAccount
        expect(canMeetThresholdLocally(stranded, [stranded])).toBe(false)
    })
})

describe('getSignaturesNeeded', () => {
    test('returns 0 when not multisig account', () => {
        mocks.isMultisigAccount.mockReturnValue(false)
        expect(getSignaturesNeeded(accountA, 0)).toBe(0)
    })

    test('returns threshold - existing', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(3, ['A', 'B', 'C'])
        expect(getSignaturesNeeded(multisig, 1)).toBe(2)
    })

    test('returns 0 when existing meets threshold', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])
        expect(getSignaturesNeeded(multisig, 2)).toBe(0)
    })

    test('returns 0 when existing exceeds threshold', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])
        expect(getSignaturesNeeded(multisig, 5)).toBe(0)
    })
})

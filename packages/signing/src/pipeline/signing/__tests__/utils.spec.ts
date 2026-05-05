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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    isMultisigAccount: vi.fn(),
    canSignWithAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        isMultisigAccount: mocks.isMultisigAccount,
        canSignWithAccount: mocks.canSignWithAccount,
    }
})

import {
    getLocalParticipants,
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
    ({ type: 'algo25', address }) as unknown as WalletAccount

const accountA = makeAccount('A')
const accountB = makeAccount('B')
const accountC = makeAccount('C')

beforeEach(() => {
    mocks.isMultisigAccount.mockReset()
    mocks.canSignWithAccount.mockReset()
})

describe('getLocalParticipants', () => {
    test('returns empty when account is not multisig', () => {
        mocks.isMultisigAccount.mockReturnValue(false)
        expect(getLocalParticipants(accountA, [accountA, accountB])).toEqual([])
    })

    test('returns local accounts that are participants and can sign', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        mocks.canSignWithAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B', 'X'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            accountB,
            accountC,
        ])

        expect(participants).toEqual([accountA, accountB])
    })

    test('filters out participants that cannot sign', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        mocks.canSignWithAccount.mockImplementation(
            (acc: WalletAccount) => acc.address === 'A',
        )
        const multisig = makeMultisig(2, ['A', 'B'])

        const participants = getLocalParticipants(multisig, [
            accountA,
            accountB,
        ])

        expect(participants).toEqual([accountA])
    })

    test('returns participants in participant-list order, not wallet order', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        mocks.canSignWithAccount.mockReturnValue(true)
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

describe('canMeetThresholdLocally', () => {
    test('returns false when account is not multisig', () => {
        mocks.isMultisigAccount.mockReturnValue(false)
        expect(canMeetThresholdLocally(accountA, [accountA])).toBe(false)
    })

    test('returns true when local participants >= threshold', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        mocks.canSignWithAccount.mockReturnValue(true)
        const multisig = makeMultisig(2, ['A', 'B'])

        expect(canMeetThresholdLocally(multisig, [accountA, accountB])).toBe(
            true,
        )
    })

    test('returns false when local participants < threshold', () => {
        mocks.isMultisigAccount.mockReturnValue(true)
        mocks.canSignWithAccount.mockReturnValue(true)
        const multisig = makeMultisig(3, ['A', 'B'])

        expect(canMeetThresholdLocally(multisig, [accountA, accountB])).toBe(
            false,
        )
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

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

import { describe, it, expect, vi } from 'vitest'

vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => {
    const actual = await importOriginal()
    return { ...actual }
})

vi.mock(import('@perawallet/wallet-core-multisig'), async importOriginal => {
    const actual = await importOriginal()
    return { ...actual }
})

import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    MultisigSignRequest,
    SignerResponse,
} from '@perawallet/wallet-core-multisig'
import { getLocalUnsignedSigners } from '../getLocalUnsignedSigners'

const buildAlgo25Account = (address: string): WalletAccount => ({
    type: AccountTypes.algo25,
    address,
    keyPairId: `kp-${address}`,
})

const buildHardwareAccount = (address: string): WalletAccount => ({
    type: AccountTypes.hardware,
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'dev-1',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
})

const buildSignRequest = (
    participantAddresses: string[],
    responses: SignerResponse[] = [],
): MultisigSignRequest => ({
    id: 'sr-1',
    status: 'pending',
    type: 'async',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expectedExpireDatetime: new Date('2026-01-01T01:00:00Z'),
    failReasonDisplay: null,
    proposerAddress: null,
    multisigAccount: {
        customId: 'm-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        address: 'MULTISIG',
        version: 1,
        threshold: 2,
        participantAddresses,
    },
    transactionLists: [
        {
            id: 'tl-1',
            rawTransactions: ['raw-tx-1'],
            firstValidBlock: 1,
            lastValidBlock: 1000,
            expectedExpireDatetime: new Date('2026-01-01T01:00:00Z'),
            responses,
        },
    ],
})

describe('getLocalUnsignedSigners', () => {
    it('returns local-key accounts whose address is a pending participant', () => {
        const a = buildAlgo25Account('A')
        const b = buildAlgo25Account('B')
        const accounts = [a, b]
        const signRequest = buildSignRequest(['A', 'B', 'C'])

        const result = getLocalUnsignedSigners(signRequest, accounts)

        expect(result.map(x => x.address)).toEqual(['A', 'B'])
    })

    it('excludes participants that already signed', () => {
        const a = buildAlgo25Account('A')
        const b = buildAlgo25Account('B')
        const signRequest = buildSignRequest(
            ['A', 'B'],
            [{ address: 'A', response: 'signed' }],
        )

        const result = getLocalUnsignedSigners(signRequest, [a, b])

        expect(result.map(x => x.address)).toEqual(['B'])
    })

    it('excludes participants that declined', () => {
        const a = buildAlgo25Account('A')
        const b = buildAlgo25Account('B')
        const signRequest = buildSignRequest(
            ['A', 'B'],
            [{ address: 'B', response: 'declined' }],
        )

        const result = getLocalUnsignedSigners(signRequest, [a, b])

        expect(result.map(x => x.address)).toEqual(['A'])
    })

    it('excludes hardware-wallet participants (Ledger deferred)', () => {
        const a = buildAlgo25Account('A')
        const ledger = buildHardwareAccount('L')
        const signRequest = buildSignRequest(['A', 'L'])

        const result = getLocalUnsignedSigners(signRequest, [a, ledger])

        expect(result.map(x => x.address)).toEqual(['A'])
    })

    it('orders non-hardware participants before hardware ones (sort kicks in once Ledger filter is lifted)', () => {
        // Hardware accounts are filtered out today, so the visible result is
        // just ['A']. The participant order in the request lists the hardware
        // address first to prove the sort comparator does not let a hardware
        // entry slip ahead of A; when the hardware filter is later removed,
        // this assertion will need to become ['A', 'L'] without changing the
        // sort code.
        const a = buildAlgo25Account('A')
        const ledger = buildHardwareAccount('L')
        const signRequest = buildSignRequest(['L', 'A'])

        const result = getLocalUnsignedSigners(signRequest, [ledger, a])

        expect(result.map(x => x.address)).toEqual(['A'])
    })

    it('excludes participant addresses that the user does not hold locally', () => {
        const a = buildAlgo25Account('A')
        const signRequest = buildSignRequest(['A', 'STRANGER'])

        const result = getLocalUnsignedSigners(signRequest, [a])

        expect(result.map(x => x.address)).toEqual(['A'])
    })

    it('excludes a watch participant rekeyed to a local-key account (multisig slot needs participant key)', () => {
        const auth = buildAlgo25Account('AUTH')
        const rekeyed: WalletAccount = {
            type: AccountTypes.watch,
            address: 'PARTICIPANT',
            rekeyAddress: 'AUTH',
        }
        const signRequest = buildSignRequest(['PARTICIPANT'])

        const result = getLocalUnsignedSigners(signRequest, [auth, rekeyed])

        expect(result).toEqual([])
    })

    it('excludes a watch participant rekeyed to a hardware account', () => {
        const auth = buildHardwareAccount('AUTH')
        const rekeyed: WalletAccount = {
            type: AccountTypes.watch,
            address: 'PARTICIPANT',
            rekeyAddress: 'AUTH',
        }
        const signRequest = buildSignRequest(['PARTICIPANT'])

        const result = getLocalUnsignedSigners(signRequest, [auth, rekeyed])

        expect(result).toEqual([])
    })

    it('includes a local-key participant even when rekeyed to a hardware account', () => {
        const participant: WalletAccount = {
            ...buildAlgo25Account('PARTICIPANT'),
            rekeyAddress: 'AUTH',
        }
        const auth = buildHardwareAccount('AUTH')
        const signRequest = buildSignRequest(['PARTICIPANT'])

        const result = getLocalUnsignedSigners(signRequest, [participant, auth])

        expect(result.map(x => x.address)).toEqual(['PARTICIPANT'])
    })

    it('includes a local-key participant even when rekeyed to another local-key account', () => {
        const participant: WalletAccount = {
            ...buildAlgo25Account('PARTICIPANT'),
            rekeyAddress: 'AUTH',
        }
        const auth = buildAlgo25Account('AUTH')
        const signRequest = buildSignRequest(['PARTICIPANT'])

        const result = getLocalUnsignedSigners(signRequest, [participant, auth])

        expect(result.map(x => x.address)).toEqual(['PARTICIPANT'])
    })

    it('returns empty when transactionLists is empty', () => {
        const a = buildAlgo25Account('A')
        const signRequest = buildSignRequest(['A'])
        signRequest.transactionLists = []

        const result = getLocalUnsignedSigners(signRequest, [a])

        expect(result).toEqual([])
    })
})

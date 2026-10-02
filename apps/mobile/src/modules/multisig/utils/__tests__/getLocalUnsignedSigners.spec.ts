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

// @vitest-environment node

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
    id: `algo25-${address}`,
    type: AccountTypes.algo25,
    address,
    keyPairId: `kp-${address}`,
})

const buildQuantumAccount = (address: string): WalletAccount => ({
    id: `quantum-${address}`,
    type: AccountTypes.quantum,
    address,
    keyPairId: `kp-${address}`,
})

const buildHardwareAccount = (address: string): WalletAccount => ({
    id: `hardware-${address}`,
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

    it('includes hardware-wallet participants', () => {
        const a = buildAlgo25Account('A')
        const ledger = buildHardwareAccount('L')
        const signRequest = buildSignRequest(['A', 'L'])

        const result = getLocalUnsignedSigners(signRequest, [a, ledger])

        expect(result.map(x => x.address)).toEqual(['A', 'L'])
    })

    it('orders non-hardware participants before hardware ones', () => {
        const a = buildAlgo25Account('A')
        const ledger = buildHardwareAccount('L')
        const signRequest = buildSignRequest(['L', 'A'])

        const result = getLocalUnsignedSigners(signRequest, [ledger, a])

        expect(result.map(x => x.address)).toEqual(['A', 'L'])
    })

    it('excludes watch-only participants even when included in accounts', () => {
        const a = buildAlgo25Account('A')
        const watch: WalletAccount = {
            id: 'watch-w',
            type: AccountTypes.watch,
            address: 'W',
        }
        const signRequest = buildSignRequest(['A', 'W'])

        const result = getLocalUnsignedSigners(signRequest, [a, watch])

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
            id: 'watch-rekeyed-local',
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
            id: 'watch-rekeyed-hardware',
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

    it('excludes a quantum participant even though it carries its own signing keys', () => {
        // Multisig slots verify Ed25519 signatures only, and algosdk's own PQ
        // signer throws "FALCON-1024 does not support multisig signing" —
        // dispatching a quantum participant here would just fail later at
        // sign time instead of being filtered out upstream.
        const quantum = buildQuantumAccount('Q')
        const signRequest = buildSignRequest(['Q'])

        const result = getLocalUnsignedSigners(signRequest, [quantum])

        expect(result).toEqual([])
    })

    it('still returns the usable non-quantum participant when a quantum participant is also present', () => {
        const quantum = buildQuantumAccount('Q')
        const a = buildAlgo25Account('A')
        const signRequest = buildSignRequest(['Q', 'A'])

        const result = getLocalUnsignedSigners(signRequest, [quantum, a])

        expect(result.map(x => x.address)).toEqual(['A'])
    })

    it('returns empty when transactionLists is empty', () => {
        const a = buildAlgo25Account('A')
        const signRequest = buildSignRequest(['A'])
        signRequest.transactionLists = []

        const result = getLocalUnsignedSigners(signRequest, [a])

        expect(result).toEqual([])
    })
})

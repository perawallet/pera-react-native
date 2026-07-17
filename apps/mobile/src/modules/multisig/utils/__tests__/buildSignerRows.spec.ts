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

import { describe, it, expect } from 'vitest'
import type {
    MultisigSignRequest,
    SignRequestStatus,
    SignerResponse,
} from '@perawallet/wallet-core-multisig'
import { buildSignerRows } from '../buildSignerRows'

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
            rawTransactions: ['raw'],
            firstValidBlock: 1,
            lastValidBlock: 1000,
            expectedExpireDatetime: new Date('2026-01-01T01:00:00Z'),
            responses,
        },
    ],
})

describe('buildSignerRows', () => {
    it('emits signed/declined rows from existing responses (canSignAsHardware/isSigning always false)', () => {
        const signRequest = buildSignRequest(
            ['A', 'B', 'C'],
            [
                { address: 'A', response: 'signed' },
                { address: 'B', response: 'declined' },
            ],
        )

        const rows = buildSignerRows({
            signRequest,
            status: 'pending',
            hardwareUnsignedSet: new Set(),
            inFlightCosignAddresses: new Set(),
        })

        expect(rows).toEqual([
            {
                address: 'A',
                status: 'signed',
                canSignAsHardware: false,
                isSigning: false,
            },
            {
                address: 'B',
                status: 'declined',
                canSignAsHardware: false,
                isSigning: false,
            },
            {
                address: 'C',
                status: 'pending',
                canSignAsHardware: false,
                isSigning: false,
            },
        ])
    })

    it.each<SignRequestStatus>(['confirmed', 'failed', 'expired', 'declined'])(
        'emits "unsigned" for un-responded participants when status is finalized (%s)',
        status => {
            const signRequest = buildSignRequest(['A'])

            const rows = buildSignerRows({
                signRequest,
                status,
                hardwareUnsignedSet: new Set(),
                inFlightCosignAddresses: new Set(),
            })

            expect(rows[0]?.status).toBe('unsigned')
        },
    )

    it('emits "pending" for un-responded participants while waiting', () => {
        const signRequest = buildSignRequest(['A'])

        const rows = buildSignerRows({
            signRequest,
            status: 'pending',
            hardwareUnsignedSet: new Set(),
            inFlightCosignAddresses: new Set(),
        })

        expect(rows[0]?.status).toBe('pending')
    })

    it('flags canSignAsHardware on a hardware-unsigned participant when not finalized', () => {
        const signRequest = buildSignRequest(['A', 'L'])

        const rows = buildSignerRows({
            signRequest,
            status: 'pending',
            hardwareUnsignedSet: new Set(['L']),
            inFlightCosignAddresses: new Set(),
        })

        expect(rows.find(r => r.address === 'L')).toMatchObject({
            canSignAsHardware: true,
            isSigning: false,
        })
        expect(rows.find(r => r.address === 'A')).toMatchObject({
            canSignAsHardware: false,
            isSigning: false,
        })
    })

    it('clears canSignAsHardware on hardware participants when status is finalized', () => {
        const signRequest = buildSignRequest(['L'])

        const rows = buildSignerRows({
            signRequest,
            status: 'expired',
            hardwareUnsignedSet: new Set(['L']),
            inFlightCosignAddresses: new Set(),
        })

        expect(rows[0]).toMatchObject({
            canSignAsHardware: false,
            isSigning: false,
        })
    })

    it('keeps canSignAsHardware true while isSigning is true (capability is independent of liveness)', () => {
        const signRequest = buildSignRequest(['L'])

        const rows = buildSignerRows({
            signRequest,
            status: 'pending',
            hardwareUnsignedSet: new Set(['L']),
            inFlightCosignAddresses: new Set(['L']),
        })

        expect(rows[0]).toMatchObject({
            canSignAsHardware: true,
            isSigning: true,
        })
    })

    it('returns empty rows when participantAddresses is empty', () => {
        const signRequest = buildSignRequest([])

        const rows = buildSignerRows({
            signRequest,
            status: 'pending',
            hardwareUnsignedSet: new Set(),
            inFlightCosignAddresses: new Set(),
        })

        expect(rows).toEqual([])
    })

    it('handles missing transactionLists by treating responses as empty', () => {
        const signRequest = buildSignRequest(['A'])
        signRequest.transactionLists = []

        const rows = buildSignerRows({
            signRequest,
            status: 'pending',
            hardwareUnsignedSet: new Set(),
            inFlightCosignAddresses: new Set(),
        })

        expect(rows).toEqual([
            {
                address: 'A',
                status: 'pending',
                canSignAsHardware: false,
                isSigning: false,
            },
        ])
    })
})

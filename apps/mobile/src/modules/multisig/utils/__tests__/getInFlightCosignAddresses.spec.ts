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
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { getInFlightCosignAddresses } from '../getInFlightCosignAddresses'

const buildCosignRequest = (
    signRequestId: string,
    signer: string,
): SignRequest =>
    ({
        id: `req-${signer}`,
        type: 'transactions',
        transport: 'callback',
        sourceType: 'multisig-cosign',
        signRequestId,
        txs: [],
        signerOverrides: new Map([[0, signer]]),
    }) as unknown as SignRequest

describe('getInFlightCosignAddresses', () => {
    it('returns an empty set when signRequestId is null', () => {
        expect(getInFlightCosignAddresses([], null)).toEqual(new Set())
    })

    it('returns an empty set when no pending requests match the id', () => {
        expect(
            getInFlightCosignAddresses(
                [buildCosignRequest('sr-OTHER', 'A')],
                'sr-1',
            ),
        ).toEqual(new Set())
    })

    it('collects signer addresses from matching cosign requests', () => {
        const result = getInFlightCosignAddresses(
            [buildCosignRequest('sr-1', 'A'), buildCosignRequest('sr-1', 'B')],
            'sr-1',
        )

        expect(result).toEqual(new Set(['A', 'B']))
    })

    it('ignores requests for a different multisig sign-request id', () => {
        const result = getInFlightCosignAddresses(
            [
                buildCosignRequest('sr-1', 'A'),
                buildCosignRequest('sr-OTHER', 'B'),
            ],
            'sr-1',
        )

        expect(result).toEqual(new Set(['A']))
    })

    it('ignores requests whose sourceType is not multisig-cosign', () => {
        const localRequest = {
            id: 'r-local',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            txs: [],
            signerOverrides: new Map([[0, 'A']]),
        } as unknown as SignRequest

        const result = getInFlightCosignAddresses([localRequest], 'sr-1')

        expect(result).toEqual(new Set())
    })

    it('ignores arbitrary-data and arc60 requests', () => {
        const dataRequest = {
            id: 'r-data',
            type: 'arbitrary-data',
            transport: 'callback',
            sourceType: 'multisig-cosign',
            signRequestId: 'sr-1',
        } as unknown as SignRequest

        const result = getInFlightCosignAddresses([dataRequest], 'sr-1')

        expect(result).toEqual(new Set())
    })

    it('ignores cosign requests without a signerOverrides entry at index 0', () => {
        const naked = {
            id: 'r-naked',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'multisig-cosign',
            signRequestId: 'sr-1',
            txs: [],
        } as unknown as SignRequest

        const result = getInFlightCosignAddresses([naked], 'sr-1')

        expect(result).toEqual(new Set())
    })
})

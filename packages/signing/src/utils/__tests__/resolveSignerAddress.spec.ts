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

import { describe, it, expect } from 'vitest'
import { resolveSignerAddress } from '../resolveSignerAddress'
import type {
    TransactionSignRequest,
    ArbitraryDataSignRequest,
    Arc60SignRequest,
} from '../../models'

const BASE = {
    id: 'req-1',
    transport: 'algod' as const,
}

describe('resolveSignerAddress', () => {
    describe('TransactionSignRequest', () => {
        it('returns undefined when txs is empty', () => {
            const request: TransactionSignRequest = {
                ...BASE,
                type: 'transactions',
                txs: [],
            }
            expect(resolveSignerAddress(request)).toBeUndefined()
        })

        it('returns the sender address of the first tx', () => {
            const request: TransactionSignRequest = {
                ...BASE,
                type: 'transactions',
                txs: [{ sender: { toString: () => 'ADDR1' } } as never],
            }
            expect(resolveSignerAddress(request)).toBe('ADDR1')
        })

        it('returns the signerOverride for index 0 when present', () => {
            const request: TransactionSignRequest = {
                ...BASE,
                type: 'transactions',
                txs: [{ sender: { toString: () => 'ADDR1' } } as never],
                signerOverrides: new Map([[0, 'OVERRIDE_ADDR']]),
            }
            expect(resolveSignerAddress(request)).toBe('OVERRIDE_ADDR')
        })

        it('returns undefined when first tx has no sender', () => {
            const request: TransactionSignRequest = {
                ...BASE,
                type: 'transactions',
                txs: [{} as never],
            }
            expect(resolveSignerAddress(request)).toBeUndefined()
        })
    })

    describe('ArbitraryDataSignRequest', () => {
        it('returns the signer from the first data entry', () => {
            const request: ArbitraryDataSignRequest = {
                ...BASE,
                type: 'arbitrary-data',
                data: [{ signer: 'SIGNER_ADDR', data: 'abc', chainId: 416001 }],
            }
            expect(resolveSignerAddress(request)).toBe('SIGNER_ADDR')
        })

        it('returns undefined when data is empty', () => {
            const request: ArbitraryDataSignRequest = {
                ...BASE,
                type: 'arbitrary-data',
                data: [],
            }
            expect(resolveSignerAddress(request)).toBeUndefined()
        })
    })

    describe('Arc60SignRequest', () => {
        it('returns the signer from stdSigData', () => {
            const request: Arc60SignRequest = {
                ...BASE,
                type: 'arc60',
                stdSigData: { signer: 'ARC60_SIGNER' } as never,
                metadata: {} as never,
            }
            expect(resolveSignerAddress(request)).toBe('ARC60_SIGNER')
        })
    })
})

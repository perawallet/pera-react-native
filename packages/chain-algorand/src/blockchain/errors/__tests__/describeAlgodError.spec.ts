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

import { describe, expect, it } from 'vitest'
import { BlockchainError, ErrorCategory } from '@perawallet/wallet-core-shared'
import { AlgodError } from '../AlgodError'
import {
    ALGOD_ERROR_I18N_KEYS,
    describeAlgodError,
} from '../describeAlgodError'

const ADDR = 'GBFKIKHL55YJRTB4PSWXWQJDPHG6IHOLESWSWPPPR6HQ2N7H76RBI5JIT4'
const OVERSPEND_MESSAGE =
    `TransactionPool.Remember: transaction TX: overspend (account ${ADDR}, ` +
    'data {AccountBaseData:{MicroAlgos:{Raw:199000}}}, tried to spend {201000})'

describe('describeAlgodError', () => {
    it('describes an AlgodError with its code keys and params', () => {
        const copy = describeAlgodError(
            new AlgodError('overspend', { address: ADDR }),
        )

        expect(copy).toEqual({
            titleKey: 'errors.algod.overspend.title',
            bodyKey: 'errors.algod.overspend.body',
            params: { address: ADDR },
        })
    })

    it('shares the no-connection copy for network_unavailable', () => {
        const copy = describeAlgodError(new AlgodError('network_unavailable', {}))

        expect(copy).toEqual({
            titleKey: 'errors.network.no_connection.title',
            bodyKey: 'errors.network.no_connection.body',
            params: {},
        })
    })

    it('describes an unknown_node_error AlgodError with its own keys', () => {
        const copy = describeAlgodError(
            new AlgodError('unknown_node_error', { raw: 'weird' }),
        )

        expect(copy?.titleKey).toBe('errors.algod.unknown_node_error.title')
    })

    it('translates a plain Error the node message parser recognises', () => {
        const copy = describeAlgodError(new Error(OVERSPEND_MESSAGE))

        expect(copy?.bodyKey).toBe('errors.algod.overspend.body')
        expect(copy?.params).toEqual({ address: ADDR })
    })

    it('leaves a plain Error nothing recognises to the caller', () => {
        expect(describeAlgodError(new Error('something odd'))).toBeUndefined()
    })

    it('leaves another AppError to its own copy', () => {
        const other = new BlockchainError('evm failed', undefined, {
            category: ErrorCategory.BLOCKCHAIN,
        })

        expect(describeAlgodError(other)).toBeUndefined()
    })

    it('ignores a non-Error value', () => {
        expect(describeAlgodError('overspend')).toBeUndefined()
    })

    it('lists every key it can return', () => {
        const keys = new Set(ALGOD_ERROR_I18N_KEYS)

        expect(keys.has('errors.algod.overspend.title')).toBe(true)
        expect(keys.has('errors.network.no_connection.body')).toBe(true)
        expect(keys.has('errors.algod.network_unavailable.title')).toBe(false)
    })
})

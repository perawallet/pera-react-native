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
import {
    AppError,
    ErrorCategory,
    isExpectedError,
} from '@perawallet/wallet-core-shared'
import {
    InvalidCaip19Error,
    UnknownEvmNetworkError,
} from '../blockchain/utils/caip19'
import { UnconfiguredEvmRpcError } from '../blockchain/utils/createEvmClient'
import { ETHEREUM, evmScopeOf } from './evm-chains'

const scope = evmScopeOf(ETHEREUM)

const rows: [string, () => AppError, ErrorCategory][] = [
    [
        'UnconfiguredEvmRpcError',
        () => new UnconfiguredEvmRpcError(scope),
        ErrorCategory.NETWORK,
    ],
    [
        'UnknownEvmNetworkError',
        () => new UnknownEvmNetworkError(scope),
        ErrorCategory.NETWORK,
    ],
    [
        'InvalidCaip19Error',
        () => new InvalidCaip19Error('eip155:1/erc20:0x0', scope),
        ErrorCategory.ASSETS,
    ],
]

describe('chain-ethereum domain errors', () => {
    it.each(rows)('%s is a classified AppError', (name, make, category) => {
        const error = make()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(category)
        expect(isExpectedError(error)).toBe(false)
    })

    it('keeps the scope and the CAIP-19 id it was built from', () => {
        expect(new UnknownEvmNetworkError(scope).scope).toEqual(scope)
        expect(new InvalidCaip19Error('eip155:1/erc20:0x0', scope).caip19).toBe(
            'eip155:1/erc20:0x0',
        )
    })
})

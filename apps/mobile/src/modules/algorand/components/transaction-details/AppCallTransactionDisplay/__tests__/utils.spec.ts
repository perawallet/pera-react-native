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
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { hasAdvancedAppCallDetails } from '../utils'

const callWith = (fields: Record<string, unknown>): AlgorandTransactionView =>
    ({
        applicationTransaction: { applicationId: 1n, ...fields },
    }) as unknown as AlgorandTransactionView

describe('hasAdvancedAppCallDetails', () => {
    it.each([
        ['arguments', { applicationArgs: [new Uint8Array([1])] }],
        ['accounts', { accounts: ['ADDRESS'] }],
        ['foreign apps', { foreignApps: [2n] }],
        ['foreign assets', { foreignAssets: [3n] }],
        ['box references', { boxReferences: [{ appIndex: 1n }] }],
    ])('is true when the call lists %s', (_label, fields) => {
        expect(hasAdvancedAppCallDetails(callWith(fields))).toBe(true)
    })

    it('is false for a call that lists none, empty lists included', () => {
        expect(hasAdvancedAppCallDetails(callWith({}))).toBe(false)
        expect(
            hasAdvancedAppCallDetails(
                callWith({
                    applicationArgs: [],
                    accounts: [],
                    boxReferences: [],
                }),
            ),
        ).toBe(false)
    })

    it('is false for a transaction with no application call', () => {
        expect(
            hasAdvancedAppCallDetails({} as unknown as AlgorandTransactionView),
        ).toBe(false)
    })
})

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

import { describe, test, expect, beforeEach } from 'vitest'
import { ScopeChangedError } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '../network-store'
import { assertScopeUnchanged, getSelectedScope } from '../selected-scope'

describe('getSelectedScope', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
    })

    test('reads the chain selection at call time', () => {
        expect(getSelectedScope('algorand')).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })

        useNetworkStore.getState().setMode('developer')
        useNetworkStore.getState().selectNetwork('algorand', 'betanet')

        expect(getSelectedScope('algorand')).toEqual({
            chainId: 'algorand',
            networkId: 'betanet',
        })
    })
})

describe('assertScopeUnchanged', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
        useNetworkStore.getState().setMode('developer')
    })

    test('passes while the captured chain keeps its network', () => {
        const captured = getSelectedScope('algorand')

        expect(() => assertScopeUnchanged(captured)).not.toThrow()
    })

    test('throws ScopeChangedError naming both scopes when the captured chain switches', () => {
        const captured = getSelectedScope('algorand')

        useNetworkStore.getState().selectNetwork('algorand', 'betanet')

        let thrown: unknown
        try {
            assertScopeUnchanged(captured)
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(ScopeChangedError)
        expect(thrown).toMatchObject({
            expected: { chainId: 'algorand', networkId: 'testnet' },
            actual: { chainId: 'algorand', networkId: 'betanet' },
        })
    })

    test('ignores a switch on another chain', () => {
        const captured = getSelectedScope('algorand')

        useNetworkStore.getState().selectNetwork('ethereum', 'sepolia')

        expect(() => assertScopeUnchanged(captured)).not.toThrow()
    })

    test("checks the captured scope's own chain, not the legacy one", () => {
        const captured = getSelectedScope('ethereum')

        useNetworkStore.getState().selectNetwork('algorand', 'betanet')
        expect(() => assertScopeUnchanged(captured)).not.toThrow()

        useNetworkStore.getState().selectNetwork('ethereum', 'sepolia')
        expect(() => assertScopeUnchanged(captured)).toThrow(ScopeChangedError)
    })
})

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

import { beforeEach, describe, expect, it } from 'vitest'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections/dappRequest'
import {
    isV1ChainIdAcceptable,
    v1NetworksFor,
    walletConnectSupportFor,
} from '../chainSupport'

// Vitest isolates each spec file's module graph, so resetting the registry
// here never reaches the other files that rely on it being registered
// (`registerDappRequestAdapter.ts`, this package's own vitest setup file).
describe('chainSupport with no chain adapter registered', () => {
    beforeEach(() => {
        dappRequestChainAdapters.reset()
    })

    it('walletConnectSupportFor returns null rather than throwing', () => {
        expect(walletConnectSupportFor('mainnet')).toBeNull()
    })

    it('isV1ChainIdAcceptable fails closed to false', () => {
        expect(isV1ChainIdAcceptable(4160, 'mainnet')).toBe(false)
        expect(isV1ChainIdAcceptable(undefined, 'mainnet')).toBe(false)
    })

    it('v1NetworksFor fails closed to an empty list', () => {
        expect(v1NetworksFor(4160)).toEqual([])
    })
})

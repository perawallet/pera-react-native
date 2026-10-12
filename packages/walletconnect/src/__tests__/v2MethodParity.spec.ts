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
import { walletConnectV2SupportFor } from '../shared/chainSupport'
import { GET_EMPTY_SIGNATURES_METHOD } from '../shared/emptySignatures'
import { AlgorandPermission } from '../models'

// chain-algorand keeps its own copy of the v2 method names (it cannot import
// this package), so this pins them to the names v1 serves under.
describe('v2 method parity with the registered adapter', () => {
    const v2 = walletConnectV2SupportFor('mainnet')
    if (!v2) {
        throw new Error(
            'no v2 support registered — registerDappRequestAdapter.ts should have run',
        )
    }

    it('serves the v1 signing permissions and the empty-signatures method', () => {
        expect(v2.methods).toEqual([
            AlgorandPermission.TX_PERMISSION,
            AlgorandPermission.DATA_PERMISSION,
            GET_EMPTY_SIGNATURES_METHOD,
        ])
    })

    it('asks the user only for the signing permissions', () => {
        expect(v2.signingMethods).toEqual([
            AlgorandPermission.TX_PERMISSION,
            AlgorandPermission.DATA_PERMISSION,
        ])
    })
})

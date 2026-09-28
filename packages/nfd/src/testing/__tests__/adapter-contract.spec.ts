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


import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { fakeNameServiceAdapter } from '../../__tests__/fakeNameServiceAdapter'
import { nameServiceContractTests } from '../adapter-contract'

// The Error a fetch polyfill rejects with on abort.
const abortError = (): Error =>
    Object.assign(new Error('Aborted'), { name: 'AbortError' })

let isReachable = true

const adapter = fakeNameServiceAdapter({
    verifyForwardResolution: async ({ signal }) => {
        if (signal?.aborted) {
            throw abortError()
        }
        return isReachable ? 'verified' : 'unavailable'
    },
})

nameServiceContractTests(() => adapter, {
    valid: ['A'.repeat(58)],
    invalid: ['A'.repeat(57), 'not an address'],
    forwardResolution: {
        params: {
            name: 'fixture.algo',
            address: 'A'.repeat(58),
            scope: scopeForLegacyNetwork('mainnet'),
        },
        arrangeUnreachable: () => {
            isReachable = false
        },
        arrangeAbortable: () => {
            isReachable = true
        },
    },
})

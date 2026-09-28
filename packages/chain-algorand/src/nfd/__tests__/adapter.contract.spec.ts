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


import { vi } from 'vitest'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { nameServiceContractTests } from '@perawallet/wallet-core-nfd/testing'
import { algorandNameServiceAdapter } from '../adapter'

const VALID = 'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'

// jsdom's DOMException is not an `Error`, unlike every runtime the app
// ships on, so the abort is modelled as the Error a fetch polyfill throws.
const abortError = (): Error =>
    Object.assign(new Error('Aborted'), { name: 'AbortError' })

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

nameServiceContractTests(() => algorandNameServiceAdapter, {
    valid: [VALID],
    // Right length and alphabet, wrong checksum.
    invalid: ['A'.repeat(58), 'not-a-real-address'],
    forwardResolution: {
        params: {
            name: 'fixture.algo',
            address: VALID,
            scope: scopeForLegacyNetwork('mainnet'),
        },
        arrangeUnreachable: () => {
            fetchMock.mockRejectedValue(new TypeError('Network request failed'))
        },
        arrangeAbortable: () => {
            fetchMock.mockImplementation(
                async (_url: string, init?: { signal?: AbortSignal }) => {
                    if (init?.signal?.aborted) {
                        throw abortError()
                    }
                    return { status: 404, ok: false, json: async () => ({}) }
                },
            )
        },
    },
})

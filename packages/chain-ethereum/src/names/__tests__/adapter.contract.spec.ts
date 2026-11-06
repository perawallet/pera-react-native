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

import { afterAll, beforeAll, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { nameServiceContractTests } from '@perawallet/wallet-core-names/testing'
import { createEvmAddressCodec } from '../../accounts/address-codec'
import { BASE, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmNameServiceAdapter } from '../adapter'

const L1 = 'https://l1.mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    chainEndpointsFor: (chainId: string) =>
        chainId === 'ethereum' ? { mainnet: [L1], sepolia: [L1] } : {},
}))

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const VALID = '0x2222222222222222222222222222222222222222'

nameServiceContractTests(
    () => createEvmNameServiceAdapter(BASE, createEvmAddressCodec(BASE)),
    {
        valid: [VALID, VALID.toUpperCase().replace('0X', '0x')],
        invalid: ['0x123', 'not-an-address', `${VALID}00`],
        forwardResolution: {
            params: {
                name: 'alice.eth',
                address: VALID,
                scope: evmScopeOf(BASE),
            },
            arrangeUnreachable: () => {
                server.use(http.post(L1, () => HttpResponse.error()))
            },
            arrangeAbortable: () => {
                server.use(http.post(L1, () => HttpResponse.json([])))
            },
        },
    },
)

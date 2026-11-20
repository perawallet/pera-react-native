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

import { describe, expect, it, vi } from 'vitest'
import { emptyBodyCopy } from '../utils'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    chainDisplayNameOf: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : undefined,
}))

describe('emptyBodyCopy', () => {
    it('says the filter matched nothing before anything else', () => {
        expect(
            emptyBodyCopy({ isFiltered: true, networkChainId: 'ethereum' }),
        ).toEqual({ key: 'asset_details.transaction_list.empty_filtered_body' })
    })

    it('gives the plain empty message on All', () => {
        expect(
            emptyBodyCopy({ isFiltered: false, networkChainId: null }).key,
        ).toBe('asset_details.transaction_list.empty_body')
    })

    it('names the network the history is narrowed to', () => {
        expect(
            emptyBodyCopy({ isFiltered: false, networkChainId: 'ethereum' }),
        ).toEqual({
            key: 'asset_details.transaction_list.empty_on_network_body',
            params: { network: 'Ethereum' },
        })
    })
})

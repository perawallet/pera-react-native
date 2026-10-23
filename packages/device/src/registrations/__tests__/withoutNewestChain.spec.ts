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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { DeviceAccountRegistration } from '../../models'
import { withoutNewestChain } from '../withoutNewestChain'

const on = (chainId: ChainId, address: string): DeviceAccountRegistration => ({
    chainId,
    address,
    accountType: 'kind',
    rank: 0,
    receiveNotifications: true,
})

describe('withoutNewestChain', () => {
    it('drops one chain at a time, newest first, down to the oldest chain', () => {
        const all = [
            on('algorand', 'A'),
            on('base', '0xb'),
            on('ethereum', '0xe'),
        ]

        const first = withoutNewestChain(all)
        const second = first && withoutNewestChain(first)

        expect(first?.map(account => account.chainId)).toEqual([
            'algorand',
            'ethereum',
        ])
        expect(second?.map(account => account.chainId)).toEqual(['algorand'])
        expect(second && withoutNewestChain(second)).toBeNull()
    })

    it('has nothing to drop from a single-chain registration', () => {
        expect(withoutNewestChain([on('algorand', 'A')])).toBeNull()
        expect(withoutNewestChain([on('ethereum', '0xe')])).toBeNull()
    })

    it('keeps the oldest chain present when the wallet holds no legacy-chain account', () => {
        expect(
            withoutNewestChain([on('base', '0xb'), on('ethereum', '0xe')])?.map(
                account => account.chainId,
            ),
        ).toEqual(['ethereum'])
    })

    it('has nothing to drop from an empty registration', () => {
        expect(withoutNewestChain([])).toBeNull()
    })
})

/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect } from 'vitest'
import { mapOnChainAccountInformation } from '../mappers'
import type { OnChainAccountInformationResponse } from '../endpoints'

const baseResponse = {
    address: 'ADDR',
    amount: 1_000_000n,
    minBalance: 100_000n,
    status: 'Offline',
    rewards: 0n,
    assets: [{ assetId: 10n, amount: 5n, isFrozen: false }],
}

describe('mapOnChainAccountInformation', () => {
    it('maps balance, assets and omits authAddress when not rekeyed', () => {
        const result = mapOnChainAccountInformation(
            baseResponse as unknown as OnChainAccountInformationResponse,
        )

        expect(result.amount).toBe(1_000_000n)
        expect(result.assets).toEqual([
            { assetId: 10n, amount: 5n, isFrozen: false },
        ])
        expect(result.authAddress).toBeUndefined()
    })

    it('surfaces authAddress as a string when the account is rekeyed', () => {
        const result = mapOnChainAccountInformation({
            ...baseResponse,
            authAddr: { toString: () => 'AUTHADDR' },
        } as unknown as OnChainAccountInformationResponse)

        expect(result.authAddress).toBe('AUTHADDR')
    })
})

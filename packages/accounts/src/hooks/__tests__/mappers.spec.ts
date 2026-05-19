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

const buildResponse = (
    overrides: Partial<OnChainAccountInformationResponse> & {
        authAddr?: { toString(): string }
    } = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): OnChainAccountInformationResponse =>
    ({
        address: 'ADDR1',
        amount: 1000n,
        minBalance: 100n,
        status: 'Online',
        rewards: 0n,
        assets: [],
        ...overrides,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any

describe('mapOnChainAccountInformation', () => {
    it('maps top-level fields and empty asset list', () => {
        const mapped = mapOnChainAccountInformation(buildResponse())

        expect(mapped).toEqual({
            address: 'ADDR1',
            amount: 1000n,
            minBalance: 100n,
            status: 'Online',
            rewards: 0n,
            assets: [],
        })
    })

    it('maps assets array preserving assetId/amount/isFrozen', () => {
        const mapped = mapOnChainAccountInformation(
            buildResponse({
                assets: [
                    { assetId: 1n, amount: 50n, isFrozen: false },
                    { assetId: 2n, amount: 0n, isFrozen: true },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ] as any,
            }),
        )

        expect(mapped.assets).toEqual([
            { assetId: 1n, amount: 50n, isFrozen: false },
            { assetId: 2n, amount: 0n, isFrozen: true },
        ])
    })

    it('returns an empty array when assets is undefined', () => {
        const mapped = mapOnChainAccountInformation(
            buildResponse({ assets: undefined }),
        )

        expect(mapped.assets).toEqual([])
    })

    it('omits authAddress when the account is not rekeyed', () => {
        const mapped = mapOnChainAccountInformation(buildResponse())

        expect(mapped.authAddress).toBeUndefined()
    })

    it('surfaces authAddress as a string when the account is rekeyed', () => {
        const mapped = mapOnChainAccountInformation(
            buildResponse({
                authAddr: { toString: () => 'AUTHADDR' },
            }),
        )

        expect(mapped.authAddress).toBe('AUTHADDR')
    })
})

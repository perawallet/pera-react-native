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

import { describe, test, expect } from 'vitest'
import {
    BANNERS_MODULE_PREFIX,
    getBannersQueryKey,
    getSpotBannersQueryKey,
    invalidateAllBannersPredicate,
} from '../querykeys'
import type { Query } from '@tanstack/react-query'

describe('banners querykeys', () => {
    test('banners list key is module-scoped and includes network + device', () => {
        const key = getBannersQueryKey('mainnet', 'dev-1')
        expect(key.at(0)).toBe(BANNERS_MODULE_PREFIX)
        expect(key).toContainEqual({ network: 'mainnet', deviceID: 'dev-1' })
    })

    test('spot banners list key is distinct from regular banners', () => {
        const k1 = getBannersQueryKey('mainnet', 'dev-1')
        const k2 = getSpotBannersQueryKey('mainnet', 'dev-1')
        expect(k1).not.toEqual(k2)
    })

    test('invalidateAllBannersPredicate matches keys under the prefix', () => {
        const matching = {
            queryKey: getBannersQueryKey('mainnet', 'dev-1'),
        } as unknown as Query
        const other = {
            queryKey: ['unrelated'],
        } as unknown as Query

        expect(invalidateAllBannersPredicate(matching)).toBe(true)
        expect(invalidateAllBannersPredicate(other)).toBe(false)
    })
})

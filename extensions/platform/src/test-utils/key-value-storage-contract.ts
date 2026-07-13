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

import { beforeEach, describe, expect, it } from 'vitest'
import type { KeyValueStorageService } from '../storage/models'

/**
 * Shared behavioral contract for every KeyValueStorageService driver.
 * Both the Chrome and RN drivers run this suite — any semantic divergence
 * (like the M1 getJSON corrupt-value mismatch) fails one of them.
 */
export const runKeyValueStorageContract = (
    name: string,
    createService: () => Promise<KeyValueStorageService>,
): void => {
    describe(`KeyValueStorageService contract: ${name}`, () => {
        let service: KeyValueStorageService

        beforeEach(async () => {
            service = await createService()
        })

        it('returns null for missing keys', () => {
            expect(service.getItem('missing')).toBeNull()
        })

        it('round-trips string values', () => {
            service.setItem('k', 'v')
            expect(service.getItem('k')).toBe('v')
        })

        it('removes items', () => {
            service.setItem('k', 'v')
            service.removeItem('k')
            expect(service.getItem('k')).toBeNull()
        })

        it('round-trips JSON values', () => {
            service.setJSON('obj', { a: 1, b: 'two' })
            expect(service.getJSON<{ a: number; b: string }>('obj')).toEqual({
                a: 1,
                b: 'two',
            })
        })

        it('returns null for missing JSON keys', () => {
            expect(service.getJSON('missing')).toBeNull()
        })

        it('returns null for corrupt JSON values', () => {
            service.setItem('corrupt', 'not-json{')
            expect(service.getJSON('corrupt')).toBeNull()
        })

        it('lists exactly the stored keys', () => {
            service.setItem('a', '1')
            service.setItem('b', '2')
            expect([...service.getAllKeys()].sort()).toEqual(['a', 'b'])
        })
    })
}

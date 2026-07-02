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

import { describe, expect, it } from 'vitest'
import { setProperty } from '../withAndroidGradleHeap'

describe('setProperty', () => {
    it('overwrites an existing property in place', () => {
        const items = [
            { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m' },
        ]

        const result = setProperty(items, 'org.gradle.jvmargs', '-Xmx6144m')

        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('-Xmx6144m')
    })

    it('appends a property that is not present', () => {
        const items = [
            { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx6144m' },
        ]

        const result = setProperty(items, 'kotlin.daemon.jvmargs', '-Xmx3072m')

        expect(result).toHaveLength(2)
        expect(
            result.find(item => item.key === 'kotlin.daemon.jvmargs')?.value,
        ).toBe('-Xmx3072m')
    })

    it('is idempotent across repeated prebuilds', () => {
        let items = [
            { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m' },
        ]

        items = setProperty(items, 'org.gradle.jvmargs', '-Xmx6144m')
        items = setProperty(items, 'org.gradle.jvmargs', '-Xmx6144m')

        const heapEntries = items.filter(
            item => item.key === 'org.gradle.jvmargs',
        )
        expect(heapEntries).toHaveLength(1)
        expect(heapEntries[0].value).toBe('-Xmx6144m')
    })
})

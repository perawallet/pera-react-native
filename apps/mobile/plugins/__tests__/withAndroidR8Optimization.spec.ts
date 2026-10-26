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
import {
    PRECISE_SHRINKING_KEY,
    STRICT_FULL_MODE_KEY,
    setR8Properties,
} from '../withAndroidR8Optimization'

type GradleProperty = { type: string; key: string; value?: string }

const valueOf = (items: GradleProperty[], key: string) =>
    items.find(item => item.key === key)?.value

describe('setR8Properties', () => {
    it('turns on precise shrinking and turns off strict keep rules', () => {
        const result: GradleProperty[] = setR8Properties([])

        expect(valueOf(result, PRECISE_SHRINKING_KEY)).toBe('true')
        expect(valueOf(result, STRICT_FULL_MODE_KEY)).toBe('false')
    })

    it('overrides a strict keep-rules value the template already set', () => {
        const items: GradleProperty[] = [
            { type: 'property', key: STRICT_FULL_MODE_KEY, value: 'true' },
        ]

        const result: GradleProperty[] = setR8Properties(items)

        expect(valueOf(result, STRICT_FULL_MODE_KEY)).toBe('false')
    })

    it('is idempotent across repeated prebuilds', () => {
        const once: GradleProperty[] = setR8Properties([])
        const twice: GradleProperty[] = setR8Properties(once)

        expect(twice).toHaveLength(2)
    })
})

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

import { describe, it, expect, beforeEach } from 'vitest'
import {
    registerPreview,
    getPreviewEntry,
    resetPreviewRegistry,
} from '../registry'

describe('preview registry', () => {
    beforeEach(() => resetPreviewRegistry())

    it('returns a registered preview entry by id', () => {
        const render = () => null
        registerPreview({ id: 'comp-foo', render })
        expect(getPreviewEntry('comp-foo')?.render).toBe(render)
    })

    it('returns undefined for an unknown id', () => {
        expect(getPreviewEntry('missing')).toBeUndefined()
    })

    it('throws on duplicate id registration', () => {
        registerPreview({ id: 'dup', render: () => null })
        expect(() =>
            registerPreview({ id: 'dup', render: () => null }),
        ).toThrow()
    })
})

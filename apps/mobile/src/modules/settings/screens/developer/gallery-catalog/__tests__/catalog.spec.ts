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
import { getCategories, getPreviewEntry } from '..'

const noopTools = {
    onSeedContacts: () => undefined,
    onReplayApi: () => undefined,
}

describe('catalog integrity', () => {
    it('has globally unique entry ids', () => {
        const ids = getCategories(noopTools).flatMap(c =>
            c.sections.flatMap(s => s.items.map(i => i.id)),
        )
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('every preview entry resolves in the registry', () => {
        const previewIds = getCategories(noopTools)
            .flatMap(c => c.sections.flatMap(s => s.items))
            .filter(i => i.launch.kind === 'preview')
            .map(i => i.id)
        previewIds.forEach(id => expect(getPreviewEntry(id)).toBeDefined())
    })
})

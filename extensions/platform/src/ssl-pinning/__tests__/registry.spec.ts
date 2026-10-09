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
import { createPinnedHostRegistry } from '../registry'

const group = {
    flag: 'enable_ssl_pinning_fixture',
    urls: ['https://node.fixture.example'],
    domains: ['fixture.example'],
}

describe('createPinnedHostRegistry', () => {
    it('lists every declared group', () => {
        const registry = createPinnedHostRegistry()
        const other = { ...group, flag: 'enable_ssl_pinning_other' }

        registry.declare(group)
        registry.declare(other)

        expect(registry.all()).toEqual([group, other])
    })

    it('replaces a group declared again under the same flag', () => {
        const registry = createPinnedHostRegistry()
        const updated = { ...group, urls: ['https://next.fixture.example'] }

        registry.declare(group)
        registry.declare(updated)

        expect(registry.all()).toEqual([updated])
    })

    it('drops every group on reset', () => {
        const registry = createPinnedHostRegistry()
        registry.declare(group)

        registry.reset()

        expect(registry.all()).toEqual([])
    })
})

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

// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { ChainModule } from '@perawallet/wallet-core-chain-contract'
import { chainModule as algorandChainModule } from '@perawallet/wallet-core-chain-algorand'
import { ethereumModule } from '@perawallet/wallet-core-chain-ethereum'
import en from '../locales/en.json'

// The chain modules load their adapters, which need the real accounts package
// rather than the app-wide double.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
}))

// i18next resolves a plural key through its suffixed forms.
const PLURAL_SUFFIXES = ['', '_one', '_other']

const hasCopy = (key: string): boolean => {
    const path = key.split('.')
    const leaf = path.pop()!
    let node: unknown = en
    for (const segment of path) {
        if (typeof node !== 'object' || node === null) return false
        node = (node as Record<string, unknown>)[segment]
    }
    if (typeof node !== 'object' || node === null) return false
    const parent = node as Record<string, unknown>
    return PLURAL_SUFFIXES.some(
        suffix => typeof parent[leaf + suffix] === 'string',
    )
}

// The literal-`t()` lint can't see keys a chain hands the app as data, so
// this is what keeps them from rendering as raw keys.
describe.each<[string, ChainModule]>([
    ['algorand', algorandChainModule],
    ['ethereum', ethereumModule],
])('the %s chain module', (_, module) => {
    it('lists only keys the English bundle has copy for', () => {
        const missing = module.i18nKeys().filter(key => !hasCopy(key))

        expect(missing).toEqual([])
    })
})

describe('hasCopy', () => {
    it('finds a key the bundle has and rejects one it lacks', () => {
        expect(hasCopy('account_info.type_ledger')).toBe(true)
        expect(hasCopy('account_info.type_not_a_kind')).toBe(false)
        expect(hasCopy('account_info')).toBe(false)
    })
})

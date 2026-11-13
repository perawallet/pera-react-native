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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PeraProject } from '@perawallet/wallet-core-projects'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import {
    directoryCategories,
    filterDirectory,
    toDirectoryDapps,
    type DirectoryDapp,
} from '../dappDirectory'

const project = (
    name: string,
    overrides: Partial<PeraProject> = {},
): PeraProject => ({
    name,
    url: `https://${name.toLowerCase()}.example`,
    chains: [],
    ...overrides,
})

const names = (items: readonly DirectoryDapp[]) =>
    items.map(item => item.dapp.name)

describe('dappDirectory', () => {
    beforeEach(() => {
        registerEthereumChain()
    })
    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    describe('toDirectoryDapps', () => {
        it('leaves out a project whose url cannot open', () => {
            const items = toDirectoryDapps([
                project('Good'),
                project('Plain', { url: 'http://plain.example' }),
                project('None', { url: undefined }),
            ])
            expect(names(items)).toEqual(['Good'])
        })

        it('keeps the first of two projects with the same normalised url', () => {
            const items = toDirectoryDapps([
                project('First', { url: 'https://same.example' }),
                project('Second', { url: 'https://same.example/' }),
            ])
            expect(names(items)).toEqual(['First'])
        })

        it('carries the description, banner and popularity, or nulls and 0', () => {
            const [full, bare] = toDirectoryDapps([
                project('Full', {
                    description: 'A DEX',
                    backgroundImage: 'https://pera.test/bg.png',
                    popularityScore: 7,
                }),
                project('Bare'),
            ])
            expect(full).toMatchObject({
                description: 'A DEX',
                backgroundImage: 'https://pera.test/bg.png',
                popularityScore: 7,
            })
            expect(bare).toMatchObject({
                description: null,
                backgroundImage: null,
                popularityScore: 0,
            })
        })
    })

    describe('filterDirectory', () => {
        // Built per test: Ethereum is registered in beforeEach.
        const sample = () =>
            toDirectoryDapps([
                project('tinyman', {
                    popularityScore: 5,
                    categories: [{ id: 'dex', title: 'DEX' }],
                }),
                project('Folks', {
                    popularityScore: 9,
                    categories: [{ id: 'lend', title: 'Lending' }],
                }),
                project('aave', {
                    popularityScore: 5,
                    chains: ['eip155:1'],
                    categories: [
                        { id: 'lend', title: 'Lending' },
                        { id: 'dex', title: 'DEX' },
                    ],
                }),
            ])

        it('keeps every chain for null and only that chain otherwise', () => {
            const items = sample()
            const all = {
                chainId: null,
                category: null,
                sort: 'popular' as const,
            }
            expect(filterDirectory(items, all)).toHaveLength(3)
            expect(
                names(filterDirectory(items, { ...all, chainId: 'ethereum' })),
            ).toEqual(['aave'])
        })

        it('filters by category title', () => {
            const items = sample()
            expect(
                names(
                    filterDirectory(items, {
                        chainId: null,
                        category: 'DEX',
                        sort: 'popular',
                    }),
                ),
            ).toEqual(['tinyman', 'aave'])
        })

        it('orders popular by score, ties in input order', () => {
            const items = sample()
            expect(
                names(
                    filterDirectory(items, {
                        chainId: null,
                        category: null,
                        sort: 'popular',
                    }),
                ),
            ).toEqual(['Folks', 'tinyman', 'aave'])
        })

        it('orders a-z by name, ignoring case', () => {
            const items = sample()
            expect(
                names(
                    filterDirectory(items, {
                        chainId: null,
                        category: null,
                        sort: 'a-z',
                    }),
                ),
            ).toEqual(['aave', 'Folks', 'tinyman'])
        })
    })

    describe('directoryCategories', () => {
        it('lists unique titles in first-seen order', () => {
            const items = toDirectoryDapps([
                project('One', { categories: [{ id: 'dex', title: 'DEX' }] }),
                project('Two', {
                    categories: [
                        { id: 'lend', title: 'Lending' },
                        { id: 'dex', title: 'DEX' },
                    ],
                }),
            ])
            expect(directoryCategories(items)).toEqual(['DEX', 'Lending'])
        })
    })
})

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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { PeraProject } from '@perawallet/wallet-core-projects'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { DiscoverDapp } from '../types'
import { normalizeDappUrl } from './normalizeDappUrl'
import { toDiscoverDapp } from './toDiscoverDapp'

export type DappSort = 'popular' | 'a-z'

/** A directory row: the dApp plus what only the details sheet and the sort read. */
export type DirectoryDapp = {
    dapp: DiscoverDapp
    description: Nullable<string>
    backgroundImage: Nullable<string>
    popularityScore: number
}

export type DirectoryFilter = {
    chainId: Nullable<ChainId>
    category: Nullable<string>
    sort: DappSort
}

/** Projects that can open, one per normalised url, in API order. */
export const toDirectoryDapps = (
    projects: readonly PeraProject[],
): DirectoryDapp[] => {
    const seen = new Set<string>()
    return projects.flatMap(project => {
        const dapp = toDiscoverDapp(project)
        if (dapp === null) return []
        const key = normalizeDappUrl(dapp.url) ?? dapp.url
        if (seen.has(key)) return []
        seen.add(key)
        return [
            {
                dapp,
                description: project.description?.trim() || null,
                backgroundImage: project.backgroundImage || null,
                popularityScore: project.popularityScore ?? 0,
            },
        ]
    })
}

export const filterDirectory = (
    items: readonly DirectoryDapp[],
    { chainId, category, sort }: DirectoryFilter,
): DirectoryDapp[] => {
    const filtered = items.filter(
        ({ dapp }) =>
            (chainId === null || dapp.chains.includes(chainId)) &&
            (category === null || dapp.categories.includes(category)),
    )
    // Array.prototype.sort is stable, so equal scores keep API order.
    return sort === 'a-z'
        ? filtered.sort((a, b) =>
              a.dapp.name.localeCompare(b.dapp.name, undefined, {
                  sensitivity: 'base',
              }),
          )
        : filtered.sort((a, b) => b.popularityScore - a.popularityScore)
}

export const directoryCategories = (
    items: readonly DirectoryDapp[],
): string[] => [...new Set(items.flatMap(({ dapp }) => dapp.categories))]

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

import type { PeraProject } from '@perawallet/wallet-core-projects'
import type { DiscoverDapp } from '../types'
import { toDiscoverDapp } from './toDiscoverDapp'

const matches = (project: PeraProject, needle: string): boolean =>
    (project.name ?? '').toLowerCase().includes(needle) ||
    (project.url ?? '').toLowerCase().includes(needle)

/** Case-insensitive substring match on name or url, most popular first. */
export const filterDappsByQuery = (
    projects: readonly PeraProject[],
    query: string,
): DiscoverDapp[] => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return []
    return projects
        .filter(project => matches(project, needle))
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .flatMap(project => {
            const dapp = toDiscoverDapp(project)
            return dapp === null ? [] : [dapp]
        })
}

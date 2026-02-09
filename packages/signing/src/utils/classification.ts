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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

export type RequestStructure = 'single' | 'group' | 'group-list'

export const classifyTransactionGroups = (
    groups: PeraDisplayableTransaction[][],
): RequestStructure => {
    if (groups.length === 1 && groups[0]?.length === 1) return 'single'
    if (groups.length === 1) return 'group'
    if (groups.length > 1) return 'group-list'
    return 'single'
}

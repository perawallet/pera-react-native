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

import type { Nullable } from '@perawallet/wallet-core-shared'

// Fallback for providers the router gives no display name (XO, Meld partners, older backends).
const PROVIDER_DISPLAY_NAMES = new Map([
    ['xo', 'XO Swap'],
    ['tinyman', 'Tinyman'],
    ['tinyman-v2', 'Tinyman v2'],
    ['tinyman-swap-router', 'Tinyman Swap Router'],
    ['vestige', 'Vestige'],
    ['vestige-v3', 'Vestige v3'],
    ['vestige-v4', 'Vestige v4'],
    ['folks-router', 'Folks Router'],
    ['deflex', 'Deflex'],
    ['haystack', 'Haystack'],
])

export const swapProviderDisplayName = (
    provider: string,
    displayName?: Nullable<string>,
): string =>
    displayName ??
    PROVIDER_DISPLAY_NAMES.get(provider.toLowerCase()) ??
    provider

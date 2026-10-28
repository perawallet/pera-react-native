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

import type { BenchScale, BenchScaleName } from './types'

export const BENCH_SCALES: Record<BenchScaleName, BenchScale> = {
    S: {
        name: 'S',
        accounts: 10,
        heavyAccountAssets: 100,
        assetsPerAccount: 5,
        heavyAccountTransactions: 500,
        chains: 1,
    },
    M: {
        name: 'M',
        accounts: 50,
        heavyAccountAssets: 1000,
        assetsPerAccount: 10,
        heavyAccountTransactions: 2000,
        chains: 3,
    },
    L: {
        name: 'L',
        accounts: 100,
        heavyAccountAssets: 5000,
        assetsPerAccount: 10,
        heavyAccountTransactions: 10_000,
        chains: 5,
    },
    XL: {
        name: 'XL',
        accounts: 200,
        heavyAccountAssets: 10_000,
        assetsPerAccount: 20,
        heavyAccountTransactions: 20_000,
        // Every chain the build enables.
        chains: 99,
    },
}

/** A fingerprint of the table: runs made on different tables never compare. */
export const scalesHash = (
    scales: Record<BenchScaleName, BenchScale>,
): string => {
    const text = JSON.stringify(
        (['S', 'M', 'L', 'XL'] as const).map(name => scales[name]),
    )
    let hash = 5381
    for (let i = 0; i < text.length; i++) {
        hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0
    }
    return hash.toString(16)
}

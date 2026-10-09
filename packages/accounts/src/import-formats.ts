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
import type { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    accountsChainAdapters,
    type LocalKeyKind,
    type LocalKeySeed,
} from './chain-adapter'

/** The key kinds a mnemonic import on `chainId` can mint, in the chain's detection order. */
export const importFormatsFor = (chainId: ChainId): readonly LocalKeyKind[] =>
    accountsChainAdapters.get(chainId).localKeyKinds

export type DetectedImportKind =
    | { success: true; seed: LocalKeySeed }
    | { success: false; wordCount: number }

/**
 * The first auto-detected kind whose word count matches. Kinds that share a
 * count with an earlier one, or opt out of detection, are reachable only from
 * their own import entry.
 */
export const detectImportKind = (
    chainId: ChainId,
    mnemonic: string,
): DetectedImportKind => {
    const wordCount = mnemonic.trim().split(/\s+/).length
    const kind = importFormatsFor(chainId).find(
        candidate =>
            candidate.isAutoDetected &&
            candidate.mnemonicWordCounts.includes(wordCount),
    )
    return kind
        ? { success: true, seed: kind.seed }
        : { success: false, wordCount }
}

/**
 * The key kind stored under `seed` on `chainId`, or `undefined` when the chain
 * doesn't mint it. Also takes a keystore `SeedScheme`, which names a kind only
 * where the custody spells it the same way.
 */
export const localKeyKindOf = (
    chainId: ChainId,
    seed: LocalKeySeed | SeedScheme,
): LocalKeyKind | undefined =>
    importFormatsFor(chainId).find(kind => kind.seed === seed)

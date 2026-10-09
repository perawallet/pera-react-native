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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    accountsChainAdapters,
    type AlternateImportKind,
    type LocalKeySeed,
} from '../chain-adapter'

/**
 * Before importing words as the kind they were detected as: the on-chain
 * accounts the same words control as another kind. Two kinds can share a
 * word count, so without this the import can silently mint an empty account
 * from words the user meant for another kind. Empty on a chain without
 * single-key accounts.
 */
export const useFindAlternateImportKinds = (scope: ChainScope) => {
    return async (
        seed: LocalKeySeed,
        /** Wordlist indices; the caller zeroes them. */
        mnemonicIndices: Uint16Array,
    ): Promise<readonly AlternateImportKind[]> => {
        const ops = accountsChainAdapters.get(scope.chainId).singleKeyAccounts
        return ops
            ? ops.findAlternateImportKinds(seed, mnemonicIndices, scope)
            : []
    }
}

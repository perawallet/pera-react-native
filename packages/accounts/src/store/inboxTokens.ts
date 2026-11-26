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
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useHiddenTokensStore } from './hiddenTokens'
import { useKeptTokensStore } from './keptTokens'

export type InboxToken = { address: string; scope: ChainScope; assetId: string }

/**
 * Accepting keeps the tokens, which lists them and counts them toward the
 * balance; rejecting hides them, so they never come back to the inbox. One
 * write per address and network, so a batch persists and refreshes once.
 */
export const settleInboxTokens = (
    tokens: readonly InboxToken[],
    isAccepted: boolean,
): void => {
    const groups = new Map<
        string,
        { address: string; scope: ChainScope; assetIds: string[] }
    >()
    for (const { address, scope, assetId } of tokens) {
        const key = `${address}|${toScopeKey(scope)}`
        const group = groups.get(key) ?? { address, scope, assetIds: [] }
        group.assetIds.push(assetId)
        groups.set(key, group)
    }
    for (const group of groups.values()) {
        if (isAccepted) {
            useKeptTokensStore.getState().keepTokens(group)
        } else {
            useHiddenTokensStore.getState().hideTokens(group)
        }
    }
}

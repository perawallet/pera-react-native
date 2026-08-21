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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { canonicalJson, contentHash } from './canonicalize'
import type {
    LocalItem,
    LocalSnapshot,
    SerializedAccount,
    SerializedItem,
} from './types'

/** Content hash ignores `updatedAt` so a pure timestamp bump is not "dirty". */
const hashOf = (item: SerializedItem): string => {
    const { updatedAt: _ignored, ...content } = item.payload as Record<
        string,
        unknown
    >
    return contentHash(canonicalJson(content))
}

const withHash = (item: SerializedItem): LocalItem => ({
    ...item,
    contentHash: hashOf(item),
})

export const buildLocalItems = async (
    accounts: WalletAccount[],
    serializeAccount: (a: WalletAccount) => Promise<SerializedAccount | null>,
): Promise<LocalSnapshot> => {
    // Keyed map dedupes shared items (the hdSeed secret repeats across every
    // child of a seed with identical content). Last write wins; safe because
    // duplicate keys only ever carry byte-identical payloads.
    const byKey = new Map<string, LocalItem>()
    let skipped = 0
    for (const account of accounts) {
        const serialized = await serializeAccount(account)
        if (serialized === null) {
            skipped += 1
            continue
        }
        const items: (SerializedItem | null)[] = [
            serialized.address,
            serialized.secrets,
            ...(serialized.extraItems ?? []),
        ]
        for (const item of items) {
            if (!item) continue
            const local = withHash(item)
            byKey.set(local.key, local)
        }
    }
    return { items: [...byKey.values()], skipped }
}

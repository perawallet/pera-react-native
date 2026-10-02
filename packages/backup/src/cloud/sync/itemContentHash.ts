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

import { isPasskeyItemKey, type BackupItemKey } from '../models'
import { canonicalJson, contentHash } from './canonicalize'

/** Fields of a passkey record that say how this device holds the credential,
 *  not what it is: a device that restored it from its key has no seed link,
 *  and its native record backfills `userId`. Hashing them would make two
 *  devices re-push the same credential at each other on every sync. */
const PASSKEY_HOLDER_FIELDS = ['seedAddress', 'userId'] as const

/** `updatedAt` is left out so a pure timestamp bump is not "dirty". */
export const itemContentHash = (
    key: BackupItemKey,
    payload: Record<string, unknown>,
): string => {
    const { updatedAt: _updatedAt, ...content } = payload
    if (isPasskeyItemKey(key)) {
        for (const field of PASSKEY_HOLDER_FIELDS) delete content[field]
    }
    return contentHash(canonicalJson(content))
}

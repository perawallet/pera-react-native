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

import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    BackupItemType,
    passkeyItemKey,
    passkeySecretsItemKey,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import { withContentHash } from './buildLocalItems'
import type { LocalItem, LocalPasskey } from './types'

/** Kept separate from `buildLocalItems` so the account builder's `skipped`
 *  count stays account-only: a credential whose key could not be read or
 *  re-derived was already dropped by the sweep upstream, so nothing here can
 *  fail. `updatedAt` is epoch millis; `pushDirty` overwrites it with the
 *  tracked `localUpdatedAt` before encrypting. Does not zero `privateKey`:
 *  the caller owns it. */
export const buildLocalPasskeyItems = (
    passkeys: readonly LocalPasskey[],
    updatedAt: number,
    hashAddress: ItemKeyHasher,
): LocalItem[] =>
    passkeys.flatMap(({ privateKey, ...passkey }) => {
        const hash = hashAddress(passkey.credentialId)
        return [
            withContentHash({
                key: passkeyItemKey(hash),
                type: BackupItemType.PASSKEY,
                payload: { ...passkey, updatedAt },
            }),
            withContentHash({
                key: passkeySecretsItemKey(hash),
                type: BackupItemType.PASSKEY,
                payload: {
                    credentialId: passkey.credentialId,
                    privateKey: encodeToBase64(privateKey),
                },
            }),
        ]
    })

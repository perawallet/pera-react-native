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

import type { BackupId, BackupItemKey } from '../models'

// TODO version needs to be updated before production
export const API_PREFIX = '/api/v3'

/** Backup root URL with the backupId segment percent-encoded for the request. */
export const backupRoot = (backupId: BackupId): string =>
    `${API_PREFIX}/backup/${encodeURIComponent(backupId)}`

/**
 * A per-item URL suffix. Only the id half is percent-encoded, so the
 * `<prefix>/<id>` route still sees two segments: a passkey id is standard
 * base64 and routinely carries `/` and `+`, which would otherwise add segments
 * the route cannot match. Accounts and contacts never hit this — their ids are
 * base32 Algorand addresses. The signed path keeps the raw key, which is what
 * the server compares after decoding its own path.
 */
export const itemUrlPathSuffix = (key: BackupItemKey): string => {
    const separator = key.indexOf('/')
    if (separator < 0) return `/${encodeURIComponent(key)}`
    return `/${key.slice(0, separator)}/${encodeURIComponent(
        key.slice(separator + 1),
    )}`
}

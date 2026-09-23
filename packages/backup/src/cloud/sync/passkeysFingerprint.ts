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

import { contentHash } from './canonicalize'
import type { BackupPasskey } from './types'

/** Sorted so a reordered list is not a change; covers the derivation inputs and
 *  the label, which are the only fields a sync needs to notice. */
export const passkeysFingerprint = (
    passkeys: readonly BackupPasskey[],
): string =>
    contentHash(
        [...passkeys]
            .map(
                p =>
                    `${p.credentialId}|${p.origin}|${p.identity}|${p.counter}|${p.displayName ?? ''}`,
            )
            .sort()
            .join('\n'),
    )

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
    MATERIAL_PREFIX,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import { LAYOUT_VERSION_KEY } from './preflight/0003-remove-layout-version-stamp'

/**
 * The storage key `@algorandfoundation/provider-migrations` serialises its
 * revision map under, the same literal upstream's own candidate filter
 * excludes. A ledger pointed at the keystore's MMKV instance must never be
 * opened as a record, and a scan must not read the master key on its account.
 */
export const MIGRATIONS_LEDGER_KEY = '@algorandfoundation/provider-migrations'

/**
 * Whether a keystore storage key can hold a flat bare-id record: not a split
 * bucket, not the ledger, and not `migrateKeystoreLayout`'s retired completion
 * stamp. `preflight/0003` deletes the stamp, but a store holding only the
 * stamp must never become a decrypt attempt.
 */
export const isFlatCandidate = (key: string): boolean =>
    !key.startsWith(MATERIAL_PREFIX) &&
    !key.startsWith(METADATA_PREFIX) &&
    key !== MIGRATIONS_LEDGER_KEY &&
    key !== LAYOUT_VERSION_KEY

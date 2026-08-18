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
import { hasNestedMaterial, type Canary13Record } from '../canary13'
import { LAYOUT_VERSION_KEY } from '../preflight/0003-remove-layout-version-stamp'

/** Same literal as `0002`/`0004` — the migrations ledger's own MMKV key. */
const MIGRATIONS_LEDGER_KEY = '@algorandfoundation/provider-migrations'

export const isFlatCandidate = (key: string): boolean =>
    !key.startsWith(MATERIAL_PREFIX) &&
    !key.startsWith(METADATA_PREFIX) &&
    key !== MIGRATIONS_LEDGER_KEY &&
    key !== LAYOUT_VERSION_KEY

export type RecordClass =
    | 'material'
    | 'nested-only'
    | 'material-less'
    | 'wrapped-passkey'
    | 'plain-passkey'

const PASSKEY_TYPES: ReadonlySet<string> = new Set([
    'hd-derived-p256',
    'xhd-derived-p256',
])

/**
 * Passkey credentials are split out because the native credential providers
 * read them at the bare id — adopting one into `k/`+`m/` takes it away from the
 * process that needs it.
 */
export const classifyRecord = (record: Canary13Record): RecordClass => {
    const type = typeof record.type === 'string' ? record.type : ''

    if ('privateKeyEnc' in record && record.privateKeyEnc !== undefined) {
        return 'wrapped-passkey'
    }

    const own = record.privateKey ?? record.seed
    if (own instanceof Uint8Array) {
        return PASSKEY_TYPES.has(type) ? 'plain-passkey' : 'material'
    }

    return hasNestedMaterial(record) ? 'nested-only' : 'material-less'
}

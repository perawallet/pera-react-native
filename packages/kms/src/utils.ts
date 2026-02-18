/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    decodeFromBase64,
    ERROR_I18N_KEYS,
} from '@perawallet/wallet-core-shared'
import { StoredKeyMaterial } from './models'
import { KeyManagementError } from './errors'

export const getSeedFromMasterKey = (
    storedKey: StoredKeyMaterial,
): Uint8Array => {
    try {
        return decodeFromBase64(storedKey.seed)
    } catch (e) {
        throw new KeyManagementError(ERROR_I18N_KEYS.INVALID_KEY, e as Error)
    }
}

export const getEntropyFromMasterKey = (
    storedKey: StoredKeyMaterial,
): Uint8Array | null => {
    try {
        return storedKey.entropy ? decodeFromBase64(storedKey.entropy) : null
    } catch (e) {
        throw new KeyManagementError(ERROR_I18N_KEYS.INVALID_KEY, e as Error)
    }
}

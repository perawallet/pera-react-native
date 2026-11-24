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
    destroyMasterKey,
    storage,
} from '@algorandfoundation/react-native-keystore'

/**
 * Empties the keystore's MMKV instance and deletes every copy of its master key, so
 * nothing sealed before a wipe can be opened after it. The engine's own
 * `clear()` removes only `m/` and `k/` records and keeps the key, leaving
 * flat records a layout migration declined to adopt readable.
 *
 * Records go first: the engine mints a new master key only while this MMKV is
 * empty, so a deleted key over a surviving record would fail every later
 * write.
 */
export const wipeKeystoreStorage = async (): Promise<void> => {
    storage.clearAll()
    if (storage.getAllKeys().length > 0) {
        throw new Error('Keystore records remain after clearing storage')
    }
    try {
        await destroyMasterKey()
        // A write that landed during the await is sealed by the destroyed key.
        if (storage.getAllKeys().length > 0) storage.clearAll()
    } finally {
        // MMKV appends rather than overwrites; compacting drops the old bytes.
        storage.trim()
    }
}

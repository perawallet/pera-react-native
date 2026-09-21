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

import { File } from 'expo-file-system'
import { InvalidCredentialsFileError } from '@perawallet/wallet-core-backup'

import { MAX_FILE_BYTES, PICKABLE_MIME_TYPES } from './readFromDevice.shared'
import type { ReadResult } from './types'

export const readFromDevice = async (): Promise<ReadResult> => {
    const picked = await File.pickFileAsync({ mimeTypes: PICKABLE_MIME_TYPES })
    // With an options object the picker reports any failure as canceled too.
    if (picked.canceled) return { status: 'cancelled' }
    if (picked.result.size > MAX_FILE_BYTES) {
        throw new InvalidCredentialsFileError()
    }
    return { status: 'read', contents: await picked.result.text() }
}

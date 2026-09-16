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

import { InvalidCredentialsFileError } from './errors'
import type { ReadResult } from './types'

// File providers label a JSON file inconsistently; the parser rejects anything
// that isn't a credentials file.
const PICKABLE_MIME_TYPES = [
    'application/json',
    'text/plain',
    'application/octet-stream',
]
// A real credentials file is a few hundred bytes; octet-stream admits any file,
// so refuse one the provider reports as large before reading it.
const MAX_FILE_BYTES = 16 * 1024

export const readFromDevice = async (): Promise<ReadResult> => {
    const picked = await File.pickFileAsync({ mimeTypes: PICKABLE_MIME_TYPES })
    // With an options object the picker reports any failure as canceled too.
    if (picked.canceled) return { status: 'cancelled' }
    if (picked.result.size > MAX_FILE_BYTES) {
        throw new InvalidCredentialsFileError()
    }
    return { status: 'read', contents: await picked.result.text() }
}

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

import { InvalidCredentialsFileError } from '@perawallet/wallet-core-backup'
import { pickTextFile } from '@utils/pickTextFile.web'

import { MAX_FILE_BYTES, PICKABLE_MIME_TYPES } from './readFromDevice.shared'
import type { ReadResult } from './types'

// Never reached from the toolbar popup: getCredentialsFileReadSources drops
// the device row there, because an OS file dialog closes the popup first.
export const readFromDevice = async (): Promise<ReadResult> => {
    const picked = await pickTextFile(
        ['.json', ...PICKABLE_MIME_TYPES].join(','),
    )
    if (!picked) return { status: 'cancelled' }
    if (picked.size > MAX_FILE_BYTES) throw new InvalidCredentialsFileError()
    return { status: 'read', contents: picked.contents }
}

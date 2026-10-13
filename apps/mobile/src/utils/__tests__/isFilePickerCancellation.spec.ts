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

import { describe, expect, test } from 'vitest'
import { isFilePickerCancellation } from '../isFilePickerCancellation'

describe('isFilePickerCancellation', () => {
    test.each([
        [
            'the directory picker message expo sends on Android',
            {
                message:
                    "Call to function 'FileSystem.pickDirectoryAsync' has been rejected. Caused by: The file picker was cancelled by the user",
            },
        ],
        [
            'the file picker message expo sends on iOS',
            { message: 'File picking was cancelled by the user' },
        ],
        ['the Android exception name', { code: 'ERR_PICKER_CANCELLED' }],
        ['the iOS exception name', { code: 'ERR_FILE_PICKING_CANCELLED' }],
    ])('treats %s as a dismissal', (_, error) => {
        expect(isFilePickerCancellation(error)).toBe(true)
    })

    test.each([
        ['a real failure', new Error('No activity found to handle Intent')],
        ['a permission failure', { code: 'ERR_PERMISSION_DENIED' }],
        ['no error at all', null],
        ['an error with no message', {}],
        // A bare `cancel` match would swallow these.
        [
            'a write failure that merely mentions cancelling',
            new Error(
                'Write failed; the operation was cancelled by the system',
            ),
        ],
        ['a cancelled download', { code: 'ERR_DOWNLOAD_CANCELLED' }],
    ])('lets %s through', (_, error) => {
        expect(isFilePickerCancellation(error)).toBe(false)
    })
})

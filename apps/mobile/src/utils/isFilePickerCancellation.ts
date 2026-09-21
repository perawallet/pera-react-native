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

// expo names these after the exception classes it throws: PickerCancelledException
// on Android, FilePickingCancelledException on iOS. Its Download/Upload
// cancellations are deliberately absent — they are not a dismissed picker.
const CANCELLED_CODES = new Set([
    'ERR_PICKER_CANCELLED',
    'ERR_FILE_PICKING_CANCELLED',
])

// R8 renames the exception class in release builds, taking the code with it, so
// the message is the only signal left there. A bare `cancel` also matches write
// and permission failures, which would then be swallowed as a dismissal, so
// match the full phrase both platforms end with.
const CANCELLED_MESSAGE = /\bwas cancell?ed by the user\b/i

/** Whether an `expo-file-system` picker rejection is the user dismissing it. */
export const isFilePickerCancellation = (error: unknown): boolean => {
    const { code, message } = (error ?? {}) as {
        code?: unknown
        message?: unknown
    }
    return (
        CANCELLED_CODES.has(String(code ?? '')) ||
        CANCELLED_MESSAGE.test(String(message ?? ''))
    )
}

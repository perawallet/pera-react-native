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

const CANCELLATION = /cancel/i

/**
 * Whether an `expo-file-system` picker rejection is the user dismissing it.
 *
 * Both signals are weak on purpose. expo derives the code from an exception
 * class name that R8 renames in release builds, so the code is absent exactly
 * where it would be most useful; the message survives minification but is
 * English and unversioned, so a reworded string would read as a real failure.
 * Matching either keeps the debug and release builds on the same path.
 */
export const isFilePickerCancellation = (error: unknown): boolean => {
    const { code, message } = (error ?? {}) as {
        code?: unknown
        message?: unknown
    }
    return (
        CANCELLATION.test(String(code ?? '')) ||
        CANCELLATION.test(String(message ?? ''))
    )
}

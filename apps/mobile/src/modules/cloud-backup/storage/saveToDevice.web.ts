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

import { shareFile } from '@utils/shareFile'

import type { SaveResult } from './types'

// The twin keeps expo-file-system's folder picker out of the web bundle.
export const saveToDevice = async (
    fileName: string,
    contents: string,
): Promise<SaveResult> => {
    const result = await shareFile(fileName, contents, {
        mimeType: 'application/json',
    })
    return result === 'shared' ? 'saved' : 'cancelled'
}

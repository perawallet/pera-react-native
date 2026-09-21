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

import { File, Paths } from 'expo-file-system'
import Share from 'react-native-share'

/** Writes `content` to the cache directory and hands it to the OS share sheet. */
export const shareFile = async (
    filename: string,
    content: string | Uint8Array<ArrayBuffer>,
    mimeType: string,
): Promise<void> => {
    const file = new File(Paths.cache, filename)
    file.create({ overwrite: true })
    file.write(content)

    await Share.open({
        url: file.uri,
        filename,
        type: mimeType,
        failOnCancel: false,
    })
}

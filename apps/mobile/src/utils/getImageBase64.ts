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

/**
 * Downloads a remote image into the cache directory and returns its bytes as
 * base64, for handing to `Clipboard.setImageAsync`. `cacheKey` is the cache
 * filename (no extension needed — the bytes are read back immediately and
 * never referenced by path again).
 */
export const getImageBase64 = async (
    imageUrl: string,
    cacheKey: string,
): Promise<string> => {
    const dest = new File(Paths.cache, cacheKey)
    const file = await File.downloadFileAsync(imageUrl, dest, {
        idempotent: true,
    })
    return file.base64()
}

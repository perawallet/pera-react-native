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
    CloudFileNotFoundError,
    type CloudFileStore,
    type ReadCloudFileOptions,
} from '@perawallet/wallet-extension-platform'

/**
 * The single one of ours in the folder, or the one the user picks from several;
 * `null` when they back out.
 */
export const resolveCandidate = async (
    entries: string[],
    store: CloudFileStore,
    { isCandidate, chooseFile }: ReadCloudFileOptions,
): Promise<string | null> => {
    const candidates = entries.filter(isCandidate)
    const [only, ...rest] = candidates
    if (!only) throw new CloudFileNotFoundError(store)
    if (rest.length === 0) return only
    return chooseFile(candidates)
}

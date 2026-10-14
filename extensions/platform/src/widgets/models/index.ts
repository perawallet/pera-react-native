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

export type WidgetImageRequest = {
    /** Stable cache key, also the file-name stem in shared storage. Digits only. */
    key: string
    /** Only https URLs are fetched. */
    url: string
}

export interface WidgetsService {
    /** Stores the serialized snapshot and asks the OS to reload widget timelines. */
    writeSnapshot(json: string): Promise<void>
    /** Removes the snapshot and every cached widget image. */
    clearSnapshot(): Promise<void>
    /**
     * Downloads and downsamples images for keys not already cached, deletes
     * cached keys absent from `items`, and resolves with the keys now on disk.
     */
    syncImages(items: WidgetImageRequest[]): Promise<string[]>
}

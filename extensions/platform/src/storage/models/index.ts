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

export interface KeyValueStorageService {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    setJSON<T>(key: string, value: T): void
    getJSON<T>(key: string): T | null
    getAllKeys(): string[]
    /**
     * Compact the underlying store, physically reclaiming space left by
     * overwritten/removed keys. On append-log backends (e.g. MMKV) a plain
     * overwrite leaves the old bytes recoverable in the file until compaction;
     * call this after removing a sensitive value to scrub the stale bytes.
     * Optional — backends without append-log residue (e.g. localStorage) may
     * omit it.
     */
    trim?(): void
}

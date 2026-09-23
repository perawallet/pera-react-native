/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

const onStorageKeyChanged = (
    areaName: 'local' | 'session',
    keys: string[],
    listener: (key: string) => void,
): (() => void) => {
    const wanted = new Set(keys)
    const handler = (
        changes: Record<string, unknown>,
        changedArea: string,
    ): void => {
        if (changedArea !== areaName) return
        for (const key of Object.keys(changes)) {
            if (wanted.has(key)) listener(key)
        }
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
}

/**
 * Typed subscription to chrome.storage.local key changes, for mobile-side
 * web code: apps/mobile compiles without chrome ambient types (they used to
 * leak repo-wide), so chrome.* access stays behind this package.
 */
export const onLocalStorageKeyChanged = (
    keys: string[],
    listener: (key: string) => void,
): (() => void) => onStorageKeyChanged('local', keys, listener)

// Same rationale as onLocalStorageKeyChanged, for the session area — used by
// UI realms adopting the service worker's minted integrity token.
export const onSessionStorageKeyChanged = (
    keys: string[],
    listener: (key: string) => void,
): (() => void) => onStorageKeyChanged('session', keys, listener)

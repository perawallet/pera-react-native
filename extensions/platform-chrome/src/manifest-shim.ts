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

// The offscreen document's chrome.runtime has no getManifest, yet the device
// service reads the manifest synchronously there: isStoreBuild decides whether
// a production store install ignores saved config overrides, and the chain
// registry asks it on every dApp request. The packaged manifest.json is the
// same object getManifest returns, a store install's update_url included.

const readPackagedManifest = (): Promise<Response> =>
    // oxlint-disable-next-line no-restricted-globals -- reads the extension's own packaged file; no backend request
    fetch('/manifest.json', { signal: AbortSignal.timeout(5000) })

/**
 * No-op where chrome.runtime.getManifest exists (every non-offscreen context).
 * MUST be awaited before anything reads the manifest.
 *
 * @throws when manifest.json cannot be read. A guessed manifest could flip the
 * store check, and a document left without one fails every dApp request, so the
 * bootstrap closes it and `ensure-offscreen` builds a new one.
 */
export const installOffscreenManifestShim = async (
    chromeLike: typeof chrome = chrome,
    readManifest: () => Promise<Response> = readPackagedManifest,
): Promise<void> => {
    if (typeof chromeLike.runtime.getManifest === 'function') return
    const response = await readManifest()
    if (!response.ok) {
        throw new Error(`manifest.json answered ${response.status}`)
    }
    const manifest = (await response.json()) as chrome.runtime.Manifest
    ;(
        chromeLike.runtime as { getManifest?: () => chrome.runtime.Manifest }
    ).getManifest = () => manifest
}

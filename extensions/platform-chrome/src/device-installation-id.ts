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

// Root-level chrome.storage.local key (NOT under the kv: prefix) so the
// identity survives app-level "clear data" flows that wipe kv: entries.
export const DEVICE_INSTALLATION_ID_STORAGE_KEY = 'device:installation-id'

/**
 * Returns this install's stable identifier, minting one if absent. Also serves
 * as the GA4 client id (see ChromeAnalyticsService).
 *
 * Not the backend device row id (`useDeviceID` in
 * `@perawallet/wallet-core-device`), which is server-assigned, per-network, and
 * recreated whenever the server stops recognising it.
 *
 * Cross-context safety: the background service worker calls this from
 * chrome.runtime.onInstalled, which fires before any UI surface can open on a
 * fresh install — so UI contexts normally only ever read. If two contexts do
 * race (e.g. storage was cleared manually), each re-reads after writing and
 * adopts whatever value actually persisted, so all callers converge on one ID.
 */
export const ensureDeviceInstallationID = async (): Promise<string> => {
    const stored = await chrome.storage.local.get(
        DEVICE_INSTALLATION_ID_STORAGE_KEY,
    )
    const existing = stored[DEVICE_INSTALLATION_ID_STORAGE_KEY]
    if (typeof existing === 'string') return existing

    const minted = crypto.randomUUID()
    await chrome.storage.local.set({
        [DEVICE_INSTALLATION_ID_STORAGE_KEY]: minted,
    })

    const check = await chrome.storage.local.get(
        DEVICE_INSTALLATION_ID_STORAGE_KEY,
    )
    const winner = check[DEVICE_INSTALLATION_ID_STORAGE_KEY]
    if (typeof winner !== 'string') {
        throw new Error(
            'device installation ID was not persisted — chrome.storage.local write failed',
        )
    }
    return winner
}

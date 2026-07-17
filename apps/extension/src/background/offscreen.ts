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

/**
 * Creates the offscreen document if absent. Only the service worker may call
 * chrome.offscreen; UI contexts request it via the DB_CONTROL_SCOPE message.
 */
export const ensureOffscreenDocument = async (): Promise<void> => {
    if (await chrome.offscreen.hasDocument()) return
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['WORKERS'],
            justification:
                'Hosts the SQLite (wasm + OPFS) database in a dedicated ' +
                'worker and keeps light account sync polling alive.',
        })
    } catch (error) {
        // A racing caller can win createDocument; losing is fine as long as
        // a document exists.
        if (!(await chrome.offscreen.hasDocument())) throw error
    }
}

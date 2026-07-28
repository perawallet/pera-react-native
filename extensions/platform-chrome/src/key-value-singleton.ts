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

import { ChromeKeyValueStorageService } from './services/key-value-storage'

// Split out of resources.ts so the pre-hydration ./bootstrap subpath can
// import hydratePlatform without dragging in ChromeDatabaseService
// (drizzle-orm) and the hardware-wallet registry that resources.ts's
// `platformServices` object eagerly constructs. resources.ts imports this
// same singleton for `platformServices.keyValueStorage`, so hydrate() and
// every later sync read/write operate on the one shared instance.
export const keyValueStorage = new ChromeKeyValueStorageService()

/**
 * Async platform bootstrap: hydrates the synchronous key-value cache from
 * chrome.storage.local. The web app shell MUST await this before its first
 * render — sync storage reads throw until it resolves.
 */
export const hydratePlatform = async (): Promise<void> => {
    await keyValueStorage.hydrate()
}

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

// Pre-hydration entry for App.web.tsx's static import path, mirroring
// keystore-chrome/src/bootstrap.ts: none of the platformServices deps the full
// index eagerly constructs (ChromeDatabaseService, hardware-wallet registry).
// The full index stays available to the dynamically-imported graph.
//
// The reference below is duplicated from index.ts because this is a separate
// root, pulled into consumer tsc programs independently of it.
/// <reference types="chrome" />
export { getSurface, type ExtensionSurface } from './surface'
export { hydratePlatform } from './key-value-singleton'
export { installOffscreenStorageShim } from './storage-proxy'

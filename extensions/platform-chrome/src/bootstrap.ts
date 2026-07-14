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

// Minimal bootstrap-only entry for App.web.tsx's static (pre-hydration)
// import path — mirrors extensions/keystore-chrome/src/bootstrap.ts. Exports
// only getSurface, hydratePlatform, and installOffscreenStorageShim: no
// ChromeDatabaseService (drizzle-orm), no hardware-wallet registry, none of
// the other platformServices dependencies the full index eagerly
// constructs. The full index (getPlatformServices, DatabaseHost, etc.) stays
// available to the dynamically-imported graph (AppShell.web, runOffscreenApp).
//
// See index.ts for why this reference is here: this file is a separate root
// pulled into consumer tsc programs (apps/mobile) independently of index.ts.
/// <reference types="chrome" />
export { getSurface, type ExtensionSurface } from './surface'
export { hydratePlatform } from './key-value-singleton'
export { installOffscreenStorageShim } from './storage-proxy'

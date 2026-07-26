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

// Minimal bootstrap-only entry for App.web.tsx's static import path.
// Exports only hydrateKeystoreStorage — no @algorandfoundation/keystore graph,
// no xhd-wallet-api, no native-module-touching deps. The full keystore surface
// (extension, store, vault) lives behind the dynamic AppShell import.
//
// See index.ts for why this reference is here: this file is a separate root
// pulled into consumer tsc programs (apps/mobile) independently of index.ts.
/// <reference types="chrome" />
export { hydrateKeystoreStorage } from './storage/chrome-storage'

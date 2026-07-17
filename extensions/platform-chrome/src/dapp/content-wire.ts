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

// Narrow entry for content scripts injected into every http/https page. The
// package barrel (../index.ts) re-exports the full platform-chrome graph
// (hydratePlatform, createWorkerExecutor, the DB host, the storage proxy —
// none of which a content script needs), which bloats content-script bundles
// to ~1MB. This file re-exports only the pure ARC-0027 wire from modules that
// have no chrome.* usage and no side effects, so the content-script build
// alias (apps/extension/scripts/build.mjs) can point here instead of the
// barrel and stay small.
export { isArc0027Request, buildErrorResponse } from './arc0027-codec'
export {
    ARC0027_ERROR_CODES,
    type Arc0027ResponseEnvelope,
} from './arc0027-types'
export { DAPP_RELAY_SCOPE } from './router-protocol'
export * from '../webview/bridge-wire'

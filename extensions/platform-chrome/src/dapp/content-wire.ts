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
// alias (apps/browser/scripts/build.mjs) can point here instead of the
// barrel and stay small.
export {
    isArc0027Request,
    // Needed alongside isArc0027Request so the injected provider can tell
    // "not addressed to us" (ignore) from "our namespace, method we don't
    // implement" (answer 4003) — dropping the latter left the dApp's promise
    // pending forever. Pure predicates, no chrome.* usage.
    isArc0027NamespacedRequest,
    referenceMethod,
    buildErrorResponse,
    ARC0027_ERROR_CODES,
    DAPP_RELAY_SCOPE,
    type Arc0027ResponseEnvelope,
} from '@perawallet/wallet-core-arc0027'
export * from '../webview/bridge-wire'
export {
    WEBAUTHN_RELAY_SCOPE,
    type WebauthnCeremonyRequest,
    type WebauthnCeremonyResponse,
} from './webauthn-router-protocol'
// Page-originated WalletConnect pair request (connect-modal-hook's
// relay-isolated.ts forwards this from the MAIN-world watcher to the
// service worker) — pure, no chrome.* usage, so it belongs in this narrow
// content-script barrel alongside the ARC-0027/WebAuthn wire above.
//
// Only the scope constant is re-exported here — DO NOT remove it, content
// scripts (relay-isolated.ts) import it via this exact alias and
// `pnpm --filter extension bundle` fails outright without it. `isWcPagePairMessage`
// / `WcPagePairMessage` are NOT re-exported: they're consumed only by
// `connect-modal-pair.ts` (a service-worker file, not a content script),
// which imports the full package barrel (`../index.ts`) instead of this one.
export { WC_PAGE_PAIR_SCOPE } from '../walletconnect/page-pair'

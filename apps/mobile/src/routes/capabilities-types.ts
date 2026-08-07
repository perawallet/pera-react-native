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
 * Capability map (design spec: "a capability map in the web bootstrap drives
 * which tabs/routes register — no scattered Platform.OS checks in screens").
 * Native resolves capabilities.ts (everything on, current behavior); web
 * resolves capabilities.web.ts. Gate UI on these flags, never on Platform.OS.
 */
export type RouteCapabilities = {
    discoverTab: boolean
    swapTab: boolean
    fundTab: boolean
    staking: boolean
    peraCard: boolean
    giftCards: boolean
    /** In-app webview screens (help center, terms links). Off ⇒ Linking.openURL. */
    inAppWebView: boolean
    qrScanner: boolean
    /** Paste-a-deeplink entry point in the Menu icon bar (web only). Replaces
     * qrScanner there: a camera is near-useless in a 360x600 toolbar popup and
     * Pera Connect now covers the pairing path scanning existed to serve. The
     * two flags are mutually exclusive per platform. */
    deepLinkPaste: boolean
    pushNotificationSettings: boolean
    walletConnectSettings: boolean
    /** Native passkey-autofill credential-manager settings (not vault passkey unlock). */
    passkeysAutofillSettings: boolean
    storeRating: boolean
    developerSettings: boolean
    /** Web vault security screen (auto-lock, lock now, passkey unlock). */
    vaultSecuritySettings: boolean
    /** ARC-0027 injected-provider dapp connections (browser-extension only;
     * not the native app's WalletConnect, tracked separately by
     * walletConnectSettings). */
    dappConnections: boolean
    /** Quantum (PQ/Falcon-1024) accounts. Off on web: the WASM signer is
     * Node/test-only today and its Emscripten build doesn't bundle for the
     * browser extension (see useIsQuantumAccountsEnabled). */
    quantum: boolean
    /** Rekey feature area (wallet-wide scan-for-rekeyed sweep, rekey-to-
     * standard/shared/ledger flows) — native-only; these stacks aren't
     * registered in WebMainRoutes. */
    rekeyFlows: boolean
    /** Multisig / shared-account flows. Off where the Multisig stack isn't
     * registered, so the SHARED_ACCOUNT_IMPORT deeplink can decline cleanly
     * instead of navigating nowhere. */
    sharedAccounts: boolean
    /** Unified settings screen merging WalletConnect sessions and ARC-0027
     * dapp connections into one list (web only). When on, it supersedes the
     * separate walletConnectSettings/dappConnections settings-menu entries —
     * their routes/screens/capabilities stay untouched for direct
     * navigation (e.g. WalletConnectSettingsDetails). */
    connectionsSettings: boolean
}

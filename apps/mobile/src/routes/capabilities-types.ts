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
 * Gate UI on these flags, never on Platform.OS. Native resolves capabilities.ts
 * (everything on); web resolves capabilities.web.ts.
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
    /** Paste-a-deeplink entry point (web only), replacing qrScanner there: a camera
     * is near-useless in a 360x600 popup. The two flags are mutually exclusive per platform. */
    deepLinkPaste: boolean
    pushNotificationSettings: boolean
    walletConnectSettings: boolean
    /** Native passkey-autofill credential-manager settings (not vault passkey unlock). */
    passkeysAutofillSettings: boolean
    /** Account switcher as a left-edge drawer over the tab shell instead of a
     * bottom sheet. Off on web: the popup has no edge-swipe affordance, and
     * PWDrawer.web.tsx is a passthrough there. */
    accountDrawer: boolean
    storeRating: boolean
    /** The slide-vs-tap confirmation choice in Advanced Preferences. Web
     * hides it: swipe is awkward with a mouse, so ConfirmAction.web.tsx
     * always uses tap-to-confirm and the setting would be a no-op. */
    confirmationModeSetting: boolean
    developerSettings: boolean
    /** Web vault security screen (auto-lock, lock now, passkey unlock). */
    vaultSecuritySettings: boolean
    /** ARC-0027 injected-provider dapp connections (browser-extension only;
     * not the native app's WalletConnect, tracked separately by
     * walletConnectSettings). */
    dappConnections: boolean
    /** Quantum (Falcon-1024) accounts. Off on web: the WASM signer's Emscripten
     * build doesn't bundle for the extension (see useIsQuantumAccountsEnabled). */
    quantum: boolean
    /** Rekey feature area (wallet-wide scan-for-rekeyed sweep, rekey-to-
     * standard/shared/ledger flows) — native-only; these stacks aren't
     * registered in WebMainRoutes. */
    rekeyFlows: boolean
    /** Multisig / shared-account flows. Off where the Multisig stack isn't
     * registered, so the SHARED_ACCOUNT_IMPORT deeplink can decline cleanly
     * instead of navigating nowhere. */
    sharedAccounts: boolean
    /** Unified settings list of WalletConnect sessions and ARC-0027 dapp connections
     * (web only). Supersedes the separate settings-menu entries; their routes stay
     * for direct navigation. */
    connectionsSettings: boolean
    /** The platform can host the password manager: native has an OS
     * credential provider to fill stored logins into other apps (compiled in
     * for non-production variants only, see app.config.builder.js), web has
     * none. Whether the surface is actually shown is a runtime decision —
     * useIsPasswordManagerEnabled folds in the enable_password_manager remote
     * flag and the production exclusion. */
    passwordManager: boolean
}

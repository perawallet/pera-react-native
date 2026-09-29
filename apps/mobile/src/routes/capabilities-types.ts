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
 * Gate UI on these flags, never on Platform.OS (pera/no-platform-os-web fails
 * `=== 'web'`). Native resolves capabilities.ts; web resolves capabilities.web.ts.
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
    /** Collectible media in a full-screen bottom sheet. Off ⇒ the raw media
     * opens in a browser tab, since a sheet can't fill the screen in a popup. */
    fullScreenMediaViewer: boolean
    qrScanner: boolean
    /** Ledger pairing over USB: Android OTG and WebHID. iOS has no USB HID route. */
    ledgerUsb: boolean
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
    /** Developer screen gallery. Off in production bundles, where Metro drops
     * its code entirely (see metro-build-gates.js), not just its entry points. */
    developerGallery: boolean
    /** Web vault security screen (auto-lock, lock now, passkey unlock). */
    vaultSecuritySettings: boolean
    /** App-lock PIN and what hangs off it: the set-PIN prompt, PIN and
     * biometrics settings, shake to lock, duress PIN. Off on web, where the
     * vault password is the lock. */
    pin: boolean
    /** Quantum (Falcon-1024) accounts. */
    quantum: boolean
    /** Rekey feature area (wallet-wide scan-for-rekeyed sweep, rekey-to-
     * standard/shared/ledger flows) — native-only; these stacks aren't
     * registered in WebMainRoutes. */
    rekeyFlows: boolean
    /** Multisig / shared-account flows. Off where the Multisig stack isn't
     * registered, so the SHARED_ACCOUNT_IMPORT deeplink can decline cleanly
     * instead of navigating nowhere. */
    sharedAccounts: boolean
    /** Unified settings list of every connection record — WalletConnect sessions
     * and `window.pera` dapp connections alike (web only). Supersedes the separate
     * settings-menu entries; their routes stay for direct navigation. */
    connectionsSettings: boolean
}

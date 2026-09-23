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

import { handleAutoLockAlarm } from '@perawallet/wallet-extension-keystore-chrome/vault/autolock'
import {
    ApprovalWindowBridge,
    CONNECTIONS_CONTROL_SCOPE,
    DB_CONTROL_SCOPE,
    PasskeyRouter,
    ensureDeviceInstallationID,
    startStorageProxyHost,
} from '@perawallet/wallet-extension-platform-chrome'
import { config } from '@perawallet/wallet-core-config'
import { installConnectModalPairRoute } from './connect-modal-pair'
import {
    CONNECTIONS_HEARTBEAT_ALARM,
    installConnectionsApprovalRouter,
    installConnectionsHeartbeat,
} from './connections'
import {
    installDappHostResponseRoute,
    installDappPageRequestRoute,
} from './dapp'
import {
    INTEGRITY_RENEW_ALARM,
    ensureIntegrityToken,
    handleIntegrityAlarm,
    installIntegrityRenewal,
} from './integrity'
import { ensureOffscreenDocument } from './offscreen'
import { installPushHandlers } from './push'

// Offscreen documents have no chrome.storage; the SW serves it over runtime
// messaging. Registered top-level so a sleeping SW wakes with the listener in place.
startStorageProxyHost()

// Also top-level: constructing the messaging instance registers the SDK's `push`
// listener, so an async init would let a worker woken by a push miss that push.
installPushHandlers()

// Same top-level discipline: a worker woken by INTEGRITY_RENEW_ALARM must
// already have its listener attached, and the token provider must be live
// before the first outgoing request on this wake.
installIntegrityRenewal()

chrome.runtime.onInstalled.addListener(details => {
    console.info('[pera] extension installed:', details.reason)
    void ensureDeviceInstallationID()
})

// The SW (esbuild) and the popup (Metro) can bake *different* config from the
// same zip; logging the resolved identity on both sides makes that comparable.
// Never the API key.
console.info('[pera] service worker config', {
    appEnvironment: config.appEnvironment,
    build: config.appBuildNumber || '(local)',
    hasApiKey: config.backendAPIKey.length > 0,
})

// onInstalled fires only on install/update; onStartup is what brings the DB
// host and sockets back after a browser restart.
chrome.runtime.onStartup.addListener(() => {
    // Rethrows when no document exists; log rather than leave an unhandled rejection.
    void ensureOffscreenDocument().catch((error: unknown) => {
        console.error('[pera] onStartup ensure-offscreen failed:', error)
    })
})

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === CONNECTIONS_HEARTBEAT_ALARM) {
        void ensureOffscreenDocument()
            .then(() =>
                chrome.runtime.sendMessage({
                    scope: CONNECTIONS_CONTROL_SCOPE,
                    kind: 'reconnect-all',
                }),
            )
            .catch((error: unknown) => {
                // A best-effort sweep nobody awaits: log rather than leave an unhandled rejection.
                console.error(
                    '[pera] connections heartbeat ensure-offscreen/reconnect failed:',
                    error,
                )
            })
        return
    }
    if (alarm.name === INTEGRITY_RENEW_ALARM) {
        void handleIntegrityAlarm(alarm)
        return
    }
    void handleAutoLockAlarm(alarm)
})

// Re-ensured on every SW wake so the DB host exists before a UI context asks.
// Not fatal on failure: UI contexts re-ask via ensure-offscreen.
void ensureOffscreenDocument().catch((error: unknown) => {
    console.error('[pera] startup ensure-offscreen failed:', error)
})

// Every SW wake re-checks the token, so a popup opening after an eviction
// finds one already warm rather than racing a mint against the user's first
// tap. ensureIntegrityToken never throws, so this needs no .catch.
void ensureIntegrityToken()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const msg = message as { scope?: string; kind?: string }
    if (msg?.scope !== DB_CONTROL_SCOPE || msg.kind !== 'ensure-offscreen') {
        return false
    }
    ensureOffscreenDocument().then(
        () => sendResponse({ ok: true }),
        error => sendResponse({ ok: false, error: String(error) }),
    )
    return true
})

const approvals = new ApprovalWindowBridge()
// Intercepted WebAuthn ceremonies share the approval surface but not the
// dapp request shape, hence a separate router.
const passkeyRouter = new PasskeyRouter(approvals)
approvals.listen()
passkeyRouter.listen()
installConnectionsApprovalRouter({ approvals })
installConnectionsHeartbeat({})
installConnectModalPairRoute({})
installDappPageRequestRoute({})
installDappHostResponseRoute({})

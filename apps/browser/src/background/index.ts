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
    ChromeDappRouter,
    DB_CONTROL_SCOPE,
    DappPermissionStore,
    PasskeyRouter,
    WC_CONTROL_SCOPE,
    ensureDeviceInstallationID,
    startStorageProxyHost,
    type DiscoverInfo,
} from '@perawallet/wallet-extension-platform-chrome'
import { config } from '@perawallet/wallet-core-config'
import { installConnectModalPairRoute } from './connect-modal-pair'
import { ensureOffscreenDocument } from './offscreen'
import { installPushHandlers } from './push'
import { parseActiveNetwork, resolveAdvertisedGenesis } from './network'
import {
    WC_HEARTBEAT_ALARM,
    installWcApprovalRouter,
    installWcHeartbeat,
} from './walletconnect'

// Offscreen documents have no chrome.storage — the SW serves it over runtime
// messaging (get/set/remove + onChanged relay). Top-level registration so a
// sleeping SW wakes with the listener in place.
startStorageProxyHost()

// Top-level, like the storage host above: constructing the SW messaging
// instance is what registers the SDK's `push` listener, so deferring this into
// an async init would let a worker woken by a push miss that very push.
installPushHandlers()

chrome.runtime.onInstalled.addListener(details => {
    console.info('[pera] extension installed:', details.reason)
    void ensureDeviceInstallationID()
})

// The service worker and the popup are bundled by different toolchains
// (esbuild -> packages/*/dist vs Metro -> packages/*/src), so they can end up
// carrying *different* baked config from the same zip. When that happens the
// only visible symptom is requests going somewhere unexpected, which looks
// like a backend problem rather than a build one. Print the resolved identity
// on both sides so the two can be compared directly. Host and channel only —
// never the API key.
console.info('[pera] service worker config', {
    appEnvironment: config.appEnvironment,
    build: config.appBuildNumber || '(local)',
    hasApiKey: config.backendAPIKey.length > 0,
})

// Fires on browser restart (unlike onInstalled, which only fires on
// install/update) — guarantees the DB host and WC socket exist again without
// waiting for some unrelated event to wake the service worker.
chrome.runtime.onStartup.addListener(() => {
    // ensureOffscreenDocument rethrows when createDocument fails and no
    // document exists; without this the browser-restart path failed silently
    // as an unhandled rejection.
    void ensureOffscreenDocument().catch((error: unknown) => {
        console.error('[pera] onStartup ensure-offscreen failed:', error)
    })
})

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === WC_HEARTBEAT_ALARM) {
        void ensureOffscreenDocument()
            .then(() =>
                chrome.runtime.sendMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'reconnect-all',
                }),
            )
            .catch((error: unknown) => {
                // Not answering a dApp here — this is the heartbeat's own
                // best-effort reconnect sweep, not a request awaiting a
                // response. Left unhandled, a failed ensure/sendMessage
                // would surface as an unhandled rejection on every tick
                // instead of just skipping this sweep.
                console.error(
                    '[pera] wc heartbeat ensure-offscreen/reconnect failed:',
                    error,
                )
            })
        return
    }
    void handleAutoLockAlarm(alarm)
})

// The DB host should exist before any UI context asks for it: every SW wake
// (browser start, popup open, message) re-ensures it. Caught for the same
// reason as the onStartup path above — a UI context that needs the host will
// re-ask via ensure-offscreen, so a failure here is not fatal, just loud.
void ensureOffscreenDocument().catch((error: unknown) => {
    console.error('[pera] startup ensure-offscreen failed:', error)
})

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

// ARC-0027 dapp relay: the permission store and approval bridge feed the
// router, which answers discover/enable/disable over chrome.runtime messaging.
// discoverInfo() advertises only the ACTIVE network (multi-network advertising
// is deferred), read out of the network store's persisted envelope rather than
// the store itself — the SW has no React tree to mount a hook in.
//
// That envelope lands in chrome.storage.local as `kv:network-store` holding a
// JSON *string*, not an object, because ChromeKeyValueStorageService prefixes
// keys and stringifies values. parseActiveNetwork handles the parse.
//
// The custom slot's chain identity comes from its own store the same way:
// `custom`'s baked chain-table row is empty by design, so without it the wallet
// would advertise `genesisHash: ''` to every dApp.
const NETWORK_STORE_KV_KEY = 'kv:network-store'
const CUSTOM_NETWORK_STORE_KV_KEY = 'kv:custom-network-store'

// The wire icon must be a data: URI, not a chrome-extension:// URL — a normal
// https dapp page cannot load the latter (no web_accessible_resources entry,
// and none should be added just for this). The service worker CAN fetch its
// own packaged resources though, so it self-encodes the icon once and caches
// the result; repeat discover calls reuse the memoized promise.
let cachedIconDataUrl: Promise<string> | null = null

const getPeraIconDataUrl = (): Promise<string> => {
    if (!cachedIconDataUrl) {
        cachedIconDataUrl = (async () => {
            try {
                const res = await fetch(
                    chrome.runtime.getURL('icons/icon-128.png'),
                )
                const bytes = new Uint8Array(await res.arrayBuffer())
                let binary = ''
                const CHUNK = 0x80_00
                for (let i = 0; i < bytes.length; i += CHUNK) {
                    binary += String.fromCharCode(
                        ...bytes.subarray(i, i + CHUNK),
                    )
                }
                return `data:image/png;base64,${btoa(binary)}`
            } catch {
                // Don't let one transient failure pin an empty icon onto
                // every later discover response for the worker's lifetime —
                // drop the memo so the next call retries.
                cachedIconDataUrl = null
                return '' // never let a missing icon break discover
            }
        })()
    }
    return cachedIconDataUrl
}

const resolveActiveNetwork = async (): Promise<
    DiscoverInfo['networks'][number]
> => {
    const raw = await chrome.storage.local.get([
        NETWORK_STORE_KV_KEY,
        CUSTOM_NETWORK_STORE_KV_KEY,
    ])
    const network = parseActiveNetwork(
        raw[NETWORK_STORE_KV_KEY] as string | undefined,
    )
    return resolveAdvertisedGenesis(
        network,
        raw[CUSTOM_NETWORK_STORE_KV_KEY] as string | undefined,
    )
}

const discoverInfo = async (): Promise<DiscoverInfo> => ({
    providerId: 'pera-wallet',
    name: 'Pera Wallet',
    iconUrl: await getPeraIconDataUrl(),
    networks: [await resolveActiveNetwork()],
})

const permissions = new DappPermissionStore(chrome.storage.local)
const approvals = new ApprovalWindowBridge()
const dappRouter = new ChromeDappRouter({
    permissions,
    discoverInfo,
    approvals,
})
// Intercepted navigator.credentials ceremonies (webauthn-relay.ts) share the
// same ApprovalWindowBridge/approval surface as the ARC-0027 flow above,
// routed by a dedicated handler since the two protocols (ARC-0027 vs. raw
// WebAuthn create/get) don't share a request shape.
const passkeyRouter = new PasskeyRouter(approvals)
approvals.listen()
dappRouter.listen()
passkeyRouter.listen()
installWcApprovalRouter({ approvals })
installWcHeartbeat({})
installConnectModalPairRoute({})

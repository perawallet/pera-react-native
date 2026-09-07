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
    ChromeDappRouter,
    DB_CONTROL_SCOPE,
    DappPermissionStore,
    PasskeyRouter,
    ensureDeviceInstallationID,
    startStorageProxyHost,
    type DiscoverInfo,
} from '@perawallet/wallet-extension-platform-chrome'
import { config } from '@perawallet/wallet-core-config'
import { installConnectModalPairRoute } from './connect-modal-pair'
import {
    CONNECTIONS_HEARTBEAT_ALARM,
    installConnectionsApprovalRouter,
    installConnectionsHeartbeat,
} from './connections'
import { ensureOffscreenDocument } from './offscreen'
import { installPushHandlers } from './push'
import { parseActiveNetwork, resolveAdvertisedGenesis } from './network'

// Offscreen documents have no chrome.storage; the SW serves it over runtime
// messaging. Registered top-level so a sleeping SW wakes with the listener in place.
startStorageProxyHost()

// Also top-level: constructing the messaging instance registers the SDK's `push`
// listener, so an async init would let a worker woken by a push miss that push.
installPushHandlers()

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
    void handleAutoLockAlarm(alarm)
})

// Re-ensured on every SW wake so the DB host exists before a UI context asks.
// Not fatal on failure: UI contexts re-ask via ensure-offscreen.
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

// No React tree in the SW: the active network is read from the persisted store
// envelope, a JSON *string* (ChromeKeyValueStorageService stringifies values).
// `custom`'s baked chain row is empty, so its genesis comes from its own store.
const NETWORK_STORE_KV_KEY = 'kv:network-store'
const CUSTOM_NETWORK_STORE_KV_KEY = 'kv:custom-network-store'

// The wire icon must be a data: URI: an https dApp page cannot load a
// chrome-extension:// URL (no web_accessible_resources entry, and none should be
// added for this). The SW can fetch its own packaged resources, so it encodes once.
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
                // Drop the memo so a transient failure doesn't pin an empty icon for the worker's lifetime.
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
// Intercepted WebAuthn ceremonies share the approval surface but not the
// ARC-0027 request shape, hence a separate router.
const passkeyRouter = new PasskeyRouter(approvals)
approvals.listen()
dappRouter.listen()
passkeyRouter.listen()
installConnectionsApprovalRouter({ approvals })
installConnectionsHeartbeat({})
installConnectModalPairRoute({})

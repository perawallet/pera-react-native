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
    DB_CONTROL_SCOPE,
    DappPermissionStore,
    DappRequestRouter,
    ensureDeviceID,
    startStorageProxyHost,
    type DiscoverInfo,
} from '@perawallet/wallet-extension-platform-chrome'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { ensureOffscreenDocument } from './offscreen'
import { parseActiveNetwork } from './network'

// Offscreen documents have no chrome.storage — the SW serves it over runtime
// messaging (get/set/remove + onChanged relay). Top-level registration so a
// sleeping SW wakes with the listener in place.
startStorageProxyHost()

chrome.runtime.onInstalled.addListener(details => {
    console.info('[pera] extension installed:', details.reason)
    void ensureDeviceID()
})

chrome.alarms.onAlarm.addListener(alarm => {
    void handleAutoLockAlarm(alarm)
})

// The DB host should exist before any UI context asks for it: every SW wake
// (browser start, popup open, message) re-ensures it.
void ensureOffscreenDocument()

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

// ARC-0027 dapp relay (Tasks 2-5): permission store + approval bridge feed
// the router, which answers discover/enable/disable over chrome.runtime
// messaging from the content-script relay. discoverInfo() advertises the
// single ACTIVE network (design decision: multi-network advertising is
// deferred), read from the network store's own persisted zustand envelope
// rather than importing the store itself — the SW has no React tree to
// mount a store hook in.
//
// The store persists through ChromeKeyValueStorageService
// (extensions/platform-chrome/src/services/key-value-storage.ts), which (a)
// prefixes every key with `kv:` and (b) stores the envelope as a
// JSON-stringified string, not an object — so the real chrome.storage.local
// entry is `kv:network-store` holding a string like
// '{"state":{"network":"testnet"},"version":1}'. parseActiveNetwork does the
// JSON.parse + validation (pure, unit-tested in ./network).
const NETWORK_STORE_KV_KEY = 'kv:network-store'

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
                return '' // never let a missing icon break discover
            }
        })()
    }
    return cachedIconDataUrl
}

const resolveActiveNetwork = async (): Promise<
    DiscoverInfo['networks'][number]
> => {
    const raw = await chrome.storage.local.get(NETWORK_STORE_KV_KEY)
    const network = parseActiveNetwork(
        raw[NETWORK_STORE_KV_KEY] as string | undefined,
    )
    const cfg = getNetworkConfig(network)
    return {
        genesisHash: cfg.genesisHash,
        genesisId: network === 'mainnet' ? 'mainnet-v1.0' : 'testnet-v1.0',
    }
}

const discoverInfo = async (): Promise<DiscoverInfo> => ({
    providerId: 'pera-wallet',
    name: 'Pera Wallet',
    iconUrl: await getPeraIconDataUrl(),
    networks: [await resolveActiveNetwork()],
})

const permissions = new DappPermissionStore(chrome.storage.local)
const approvals = new ApprovalWindowBridge()
const dappRouter = new DappRequestRouter({
    permissions,
    discoverInfo,
    approvals,
})
approvals.listen()
dappRouter.listen()

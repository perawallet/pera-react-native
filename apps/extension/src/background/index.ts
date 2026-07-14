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

import { handleAutoLockAlarm } from '@perawallet/wallet-extension-keystore-chrome/vault/autolock'
import {
    DB_CONTROL_SCOPE,
    ensureDeviceID,
    startStorageProxyHost,
} from '@perawallet/wallet-extension-platform-chrome'
import { ensureOffscreenDocument } from './offscreen'

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

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

// The v3 devices API reads these exact bodies: a change here is a change to
// the backend contract, never a test update.

export const GOLDEN_DEVICE_ACCOUNT_TYPES = {
    algo25: 'algo25',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    multisig: 'multisig',
    watch: 'watch',
    quantum: 'quantum',
}

const GOLDEN_REGISTRATION_ACCOUNTS = `[
    { "address": "ALGO25ADDR", "account_type": "algo25", "receive_notifications": true },
    { "address": "HDCHILDADDR", "account_type": "hdWallet", "receive_notifications": true },
    { "address": "LEDGERADDR", "account_type": "hardware", "receive_notifications": true },
    { "address": "MSIGADDR", "account_type": "multisig", "receive_notifications": true },
    { "address": "WATCHADDR", "account_type": "watch", "receive_notifications": false },
    { "address": "QUANTUMADDR", "account_type": "quantum", "receive_notifications": true }
]`

export const GOLDEN_UPDATE_REQUEST = `{
    "id": "3502762836822418987",
    "push_token": "fcm-token",
    "platform": "ios",
    "locale": "en-US",
    "app_version": "7.0.1",
    "currency": "USD",
    "accounts": ${GOLDEN_REGISTRATION_ACCOUNTS}
}`

export const GOLDEN_CREATE_REQUEST = `{
    "push_token": "fcm-token",
    "platform": "android",
    "locale": "en-US",
    "app_version": "7.0.1",
    "accounts": []
}`

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

// The v4 devices API reads these exact bodies: a change here is a change to
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
    { "address": "ALGO25ADDR", "chain": "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k", "account_type": "algo25", "receive_notifications": true },
    { "address": "HDCHILDADDR", "chain": "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k", "account_type": "hdWallet", "receive_notifications": true },
    { "address": "LEDGERADDR", "chain": "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k", "account_type": "hardware", "receive_notifications": true },
    { "address": "MSIGADDR", "chain": "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k", "account_type": "multisig", "receive_notifications": true },
    { "address": "WATCHADDR", "chain": "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k", "account_type": "watch", "receive_notifications": false },
    { "address": "QUANTUMADDR", "chain": "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k", "account_type": "quantum", "receive_notifications": true },
    { "address": "0x52908400098527886e0f7030069857d2e4169ee7", "chain": "eip155:1", "account_type": "hdWallet", "receive_notifications": true },
    { "address": "0x8617e340b3d01fa5f11f306f4090fd50e238070d", "chain": "eip155:1", "account_type": "hardware", "receive_notifications": true },
    { "address": "0xde709f2102306220921060314715629080e2fb77", "chain": "eip155:1", "account_type": "watch", "receive_notifications": false }
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

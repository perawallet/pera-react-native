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
 * The record types the native passkey credential provider owns.
 * `xhd-derived-p256` is the legacy spelling its read path still accepts.
 */
export const PASSKEY_CREDENTIAL_TYPES: ReadonlySet<string> = new Set([
    'hd-derived-p256',
    'xhd-derived-p256',
])

export const isPasskeyCredentialType = (type: unknown): boolean =>
    typeof type === 'string' && PASSKEY_CREDENTIAL_TYPES.has(type)

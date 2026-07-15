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

// Reason codes mirror the legacy native apps' explicit error cases. UI maps
// each to a localized string under `onboarding.pera_web_import.errors.*`.
export const PeraWebImportErrorReason = {
    /** QR text isn't JSON or is missing required fields. */
    MalformedQr: 'malformed_qr',
    /** QR `version` is present and is not "1" (iOS rejects this). */
    UnsupportedVersion: 'unsupported_version',
    /** QR `action` is present and is not "import" (iOS rejects this). */
    UnsupportedAction: 'unsupported_action',
    /** Backend returned an empty / missing encrypted_content. */
    EmptyContent: 'empty_content',
    /** secretbox MAC failed — wrong key, tampered ciphertext, or short input. */
    DecryptionFailed: 'decryption_failed',
    /** Decrypted plaintext wasn't valid JSON or had the wrong shape. */
    MalformedPayload: 'malformed_payload',
    /** Network/API failure while fetching the encrypted blob. */
    NetworkFailed: 'network_failed',
} as const

export type PeraWebImportErrorReason =
    (typeof PeraWebImportErrorReason)[keyof typeof PeraWebImportErrorReason]

export class PeraWebImportError extends Error {
    readonly reason: PeraWebImportErrorReason

    constructor(reason: PeraWebImportErrorReason, message?: string) {
        super(message ?? reason)
        this.name = 'PeraWebImportError'
        this.reason = reason
    }
}

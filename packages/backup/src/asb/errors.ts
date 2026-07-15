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

// Reason codes drive UI copy. Keep them stable; locale keys are derived
// from them in apps/mobile (see en.json `onboarding.asb_import.errors.*`).
export const AsbErrorReason = {
    EmptyFile: 'empty_file',
    NotBase64: 'not_base64',
    MalformedEnvelope: 'malformed_envelope',
    UnsupportedVersion: 'unsupported_version',
    UnsupportedSuite: 'unsupported_suite',
    InvalidRecoveryKey: 'invalid_recovery_key',
    DecryptionFailed: 'decryption_failed',
    MalformedPayload: 'malformed_payload',
} as const

export type AsbErrorReason =
    (typeof AsbErrorReason)[keyof typeof AsbErrorReason]

export class AsbImportError extends Error {
    readonly reason: AsbErrorReason

    constructor(reason: AsbErrorReason, message?: string) {
        super(message ?? reason)
        this.name = 'AsbImportError'
        this.reason = reason
    }
}

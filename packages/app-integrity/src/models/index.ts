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

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'

export type IntegrityPlatform = 'ios' | 'android' | 'web'

export type IntegrityRegistration = {
    integrityToken: string
    expiresAt: string
}

export type IntegrityVerification = {
    ok: boolean
    deviceInstallationId: string
    platform: IntegrityPlatform
}

export type IntegrityEnrolment = {
    enrolled: boolean
    kid: string
}

export type AttestPayload =
    | {
          deviceInstallationId: string
          platform: 'ios'
          keyId: string
          attestation: string
      }
    | { deviceInstallationId: string; platform: 'android'; attestation: string }
    | {
          deviceInstallationId: string
          platform: 'web'
          publicKey: string
          signature: string
      }

export type AppIntegrityStatus =
    | 'idle'
    | 'registering'
    | 'success'
    | 'skipped'
    | 'error'

export type AppIntegrityStore = BaseStoreState & {
    integrityToken: Nullable<string>
    expiresAt: Nullable<string>
    keyId: Nullable<string>
    deviceInstallationId: Nullable<string>
    status: AppIntegrityStatus
    lastError: Nullable<string>
    lastAttemptAt: Nullable<string>
    lastSuccessAt: Nullable<string>
    setRegistration: (input: {
        integrityToken: string
        expiresAt: string
        keyId: Nullable<string>
        deviceInstallationId: string
    }) => void
    setStatus: (status: AppIntegrityStatus) => void
    setError: (message: string) => void
    setLastAttemptAt: (iso: string) => void
}

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

/**
 * Platform-agnostic device attestation result. The opaque `attestation` is sent
 * to the backend for verification; `keyId` is only set on platforms that issue a
 * reusable attestation key (iOS App Attest) and is omitted elsewhere.
 */
export type AppIntegrityAttestation = {
    attestation: string
    keyId?: string
}

/**
 * Abstracts per-platform device integrity (iOS App Attest, Android Play
 * Integrity, and future targets) behind a single attest call. Implementations
 * own all platform-specific key handling and challenge hashing.
 */
export interface AppIntegrityService {
    /** Whether device attestation is available on this platform/device. */
    isSupported(): Promise<boolean>
    /** Produce an attestation bound to the server-issued challenge. */
    attest(challenge: string): Promise<AppIntegrityAttestation>
}

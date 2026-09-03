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

import type {
    AppIntegrityAttestation,
    AppIntegrityService,
} from '@perawallet/wallet-extension-platform'
import * as AppIntegrity from '@expo/app-integrity'
import { config } from '@perawallet/wallet-core-config'
import { Platform } from 'react-native'
import { Buffer } from 'buffer'
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Play Integrity request hash: base64(SHA256(utf8(challengeString))). Must match
 * the backend's recomputation over the same challenge string.
 */
const computeRequestHash = (challenge: string): string =>
    Buffer.from(sha256(new TextEncoder().encode(challenge))).toString('base64')

export class RNAppIntegrityService implements AppIntegrityService {
    isSupported(): Promise<boolean> {
        // `AppIntegrity.isSupported` reflects iOS App Attest availability and is
        // always true on Android (real Play Integrity availability surfaces at
        // attest time).
        return Promise.resolve(AppIntegrity.isSupported)
    }

    async attest(challenge: string): Promise<AppIntegrityAttestation> {
        if (Platform.OS === 'ios') {
            const keyId = await AppIntegrity.generateKeyAsync()
            const attestation = await AppIntegrity.attestKeyAsync(
                keyId,
                challenge,
            )
            return { attestation, keyId }
        }

        await AppIntegrity.prepareIntegrityTokenProviderAsync(
            config.playIntegrityCloudProjectNumber,
        )
        const attestation = await AppIntegrity.requestIntegrityCheckAsync(
            computeRequestHash(challenge),
        )
        return { attestation }
    }
}

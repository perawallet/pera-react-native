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

import {
    queryClient,
    IDEMPOTENT_POST_RETRY,
    type Network,
} from '@perawallet/wallet-core-shared'
import {
    challengeResponseSchema,
    attestResponseSchema,
    verifyResponseSchema,
} from './schema'
import {
    transformAttestResponse,
    transformVerifyResponse,
} from './transformers'
import type {
    AttestPayload,
    IntegrityPlatform,
    IntegrityRegistration,
    IntegrityVerification,
} from '../../models'

export type RequestChallengeParams = {
    deviceInstallationId: string
    platform: IntegrityPlatform
    network: Network
    signal?: AbortSignal
}

export const requestChallenge = async ({
    deviceInstallationId,
    platform,
    network,
    signal,
}: RequestChallengeParams): Promise<string> => {
    const response = await queryClient<unknown>({
        backend: 'pera',
        network,
        method: 'POST',
        url: '/api/v3/public/integrity/challenge',
        data: { device_id: deviceInstallationId, platform },
        signal,
        // The handshake fires once at boot and is not retried at the caller
        // (see useAppIntegrityBootstrap's boot-once latch), so a single
        // transport blip costs the session its attestation — and with it
        // fee delegation. Minting a challenge has no side effect to repeat.
        retry: IDEMPOTENT_POST_RETRY,
    })
    return challengeResponseSchema.parse(response.data).challenge
}

export type AttestDeviceParams = {
    payload: AttestPayload
    network: Network
    signal?: AbortSignal
}

export const attestDevice = async ({
    payload,
    network,
    signal,
}: AttestDeviceParams): Promise<IntegrityRegistration> => {
    const data =
        payload.platform === 'ios'
            ? {
                  device_id: payload.deviceInstallationId,
                  platform: 'ios',
                  key_id: payload.keyId,
                  attestation: payload.attestation,
              }
            : {
                  device_id: payload.deviceInstallationId,
                  platform: 'android',
                  attestation: payload.attestation,
              }
    const response = await queryClient<unknown>({
        backend: 'pera',
        network,
        method: 'POST',
        url: '/api/v3/public/integrity/attest',
        data,
        signal,
        // Retried only when the attempt produced no response at all, so the
        // backend either never saw it or its reply was lost. Re-attesting the
        // same device re-issues a token, which is the outcome we want either
        // way — the challenge is still the one this attestation was built for.
        retry: IDEMPOTENT_POST_RETRY,
    })
    return transformAttestResponse(attestResponseSchema.parse(response.data))
}

export type VerifyIntegrityTokenParams = {
    integrityToken: string
    network: Network
    signal?: AbortSignal
}

export const verifyIntegrityToken = async ({
    integrityToken,
    network,
    signal,
}: VerifyIntegrityTokenParams): Promise<IntegrityVerification> => {
    const response = await queryClient<unknown>({
        backend: 'pera',
        network,
        method: 'GET',
        url: '/api/v3/test-integrity',
        headers: { 'x-app-integrity-token': integrityToken },
        signal,
    })
    return transformVerifyResponse(verifyResponseSchema.parse(response.data))
}

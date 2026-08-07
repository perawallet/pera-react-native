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

import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    isConnectivityError,
    logger,
    type Network,
} from '@perawallet/wallet-core-shared'
import { requestChallenge, attestDevice } from '../api/integrity'
import { useAppIntegrityStore } from '../store'
import type { AppIntegrityStatus, AttestPayload } from '../models'

export type RegisterAppIntegrityParams = {
    network: Network
    signal?: AbortSignal
}

export type RegisterAppIntegrityResult = {
    status: AppIntegrityStatus
    error?: string
}

export const registerAppIntegrity = async ({
    network,
    signal,
}: RegisterAppIntegrityParams): Promise<RegisterAppIntegrityResult> => {
    const store = useAppIntegrityStore.getState()
    const { deviceInfo, appIntegrity } = getProvider()

    // App Attest only runs on distributed builds (staging + production), which
    // always operate in Apple's production attestation environment. Local
    // development builds emit sandbox attestations that the production-configured
    // backend rejects, so attestation is skipped there entirely.
    if (deviceInfo.getAppEnvironment() === 'development') {
        store.setStatus('skipped')
        return { status: 'skipped' }
    }

    store.setStatus('registering')
    store.setLastAttemptAt(new Date().toISOString())

    try {
        const platform = deviceInfo.getDevicePlatform()
        if (platform !== 'ios' && platform !== 'android') {
            store.setStatus('skipped')
            return { status: 'skipped' }
        }
        if (!(await appIntegrity.isSupported())) {
            store.setStatus('skipped')
            return { status: 'skipped' }
        }

        const deviceInstallationId = await deviceInfo.getDeviceInstallationID()
        const challenge = await requestChallenge({
            deviceInstallationId,
            platform,
            network,
            signal,
        })

        const { attestation, keyId } = await appIntegrity.attest(challenge)

        let payload: AttestPayload
        if (platform === 'ios') {
            if (!keyId) {
                throw new Error('iOS attestation did not return a key id')
            }
            payload = {
                deviceInstallationId,
                platform: 'ios',
                keyId,
                attestation,
            }
        } else {
            payload = { deviceInstallationId, platform: 'android', attestation }
        }

        const { integrityToken, expiresAt } = await attestDevice({
            payload,
            network,
            signal,
        })

        store.setRegistration({
            integrityToken,
            expiresAt,
            keyId: payload.platform === 'ios' ? payload.keyId : null,
            deviceInstallationId,
        })
        return { status: 'success' }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (isConnectivityError(error)) {
            // The handshake runs once at boot, so it races the network coming
            // up; an offline device retries on the next launch and needs no
            // attention. The status still goes to the store for the UI.
            logger.warn('App integrity registration skipped: device offline', {
                step: 'registerAppIntegrity',
            })
        } else {
            // Report the error itself rather than a fixed string. A constant
            // message collapses every distinct cause — native attestation
            // failure, backend rejection, response-schema drift — into one
            // untriageable crash-reporter issue with no stack.
            logger.error(error instanceof Error ? error : message, {
                step: 'registerAppIntegrity',
            })
        }
        store.setError(message)
        return { status: 'error', error: message }
    }
}

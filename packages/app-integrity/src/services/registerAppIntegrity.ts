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

import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    isConnectivityError,
    logger,
    toError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { requestChallenge, attestDevice } from '../api/integrity'
import { useAppIntegrityStore } from '../store'
import type { AppIntegrityStatus, AttestPayload } from '../models'

export type RegisterAppIntegrityParams = {
    deployment: WalletMode
    signal?: AbortSignal
}

export type RegisterAppIntegrityResult = {
    status: AppIntegrityStatus
    error?: string
}

/** The longest a guarded request holds for the launch's attestation. */
export const INTEGRITY_REGISTRATION_WAIT_MS = 10_000

let inFlight: Nullable<{ promise: Promise<unknown>; startedAt: number }> = null

/**
 * Resolves when the registration in flight settles, at once when none is, or
 * `timeoutMs` after it started: the deadline is the registration's, so a hung
 * attestation costs each later call nothing. Never rejects. Before the launch
 * hook has started one, nothing is in flight and this returns at once; guarded
 * queries only mount after that hook's first effect.
 */
export const waitForIntegrityRegistration = (
    timeoutMs: number = INTEGRITY_REGISTRATION_WAIT_MS,
): Promise<void> => {
    if (!inFlight) return Promise.resolve()
    const { promise: pending, startedAt } = inFlight
    const remaining = startedAt + timeoutMs - Date.now()
    if (remaining <= 0) return Promise.resolve()
    return new Promise<void>(resolve => {
        const timer = setTimeout(resolve, remaining)
        const done = () => {
            clearTimeout(timer)
            resolve()
        }
        pending.then(done, done)
    })
}

const runRegistration = async ({
    deployment,
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
            deployment,
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
            deployment,
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
        const message = toError(error).message
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

export const registerAppIntegrity = (
    params: RegisterAppIntegrityParams,
): Promise<RegisterAppIntegrityResult> => {
    const registration = runRegistration(params)
    const entry = { promise: registration, startedAt: Date.now() }
    inFlight = entry
    const clear = () => {
        if (inFlight === entry) inFlight = null
    }
    registration.then(clear, clear)
    return registration
}

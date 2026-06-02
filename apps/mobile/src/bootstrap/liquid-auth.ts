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

import {
    bootstrapLiquidAuth,
    setLiquidAuthKeystoreHost,
} from '@perawallet/wallet-extension-liquid-auth'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { logger } from '@perawallet/wallet-core-shared'

import type { CredentialMechanism } from '@perawallet/wallet-extension-liquid-auth'

/**
 * One-time Liquid Auth startup: wires the keystore host then registerGlobals +
 * the navigator.credentials polyfill.
 *
 * The app is the only layer that depends on both the provider and the
 * liquid-auth extension, so it injects the provider's keystore/biometrics into
 * liquid-auth here. liquid-auth therefore never imports the provider (which
 * composes it via `WithLiquidAuth`), avoiding a build-graph cycle.
 */
export const runLiquidAuthBootstrap = async (
    mechanism: CredentialMechanism,
): Promise<void> => {
    try {
        setLiquidAuthKeystoreHost({
            getKeyStore: () => getProvider().key.store,
            getKeys: () => getKeystoreStore().state.keys,
            getBiometrics: () => getProvider().biometrics,
        })
        await bootstrapLiquidAuth(mechanism)
    } catch (error) {
        logger.error('Liquid Auth bootstrap failed', { error })
    }
}

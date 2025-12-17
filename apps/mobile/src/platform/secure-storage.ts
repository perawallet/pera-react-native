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

import * as Keychain from 'react-native-keychain'
import type { SecureStorageService } from '@perawallet/wallet-core-platform-integration'

const SERVICE_PREFIX = 'com.algorand.android'

type Options = {
    service?: string
    requireBiometrics?: boolean
    promptTitle?: string
    promptDesc?: string
}

//TODO currently we're storing data in the keychain with a different "service" per key
//Is that right or should we be storing it differently?  Should this mirror the current
//native storage so we don't have to move things?
export class RNSecureStorageService implements SecureStorageService {
    private baseOpts: Keychain.SetOptions = {}
    private utf8encoder = new TextEncoder()
    private utf8decoder = new TextDecoder()

    async initialize(options: Options = {}) {
        const {
            service = SERVICE_PREFIX,
            requireBiometrics = true,
            promptTitle = 'Authenticate',
            promptDesc = 'Access secure data',
        } = options

        this.baseOpts = {
            service,
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            accessControl: requireBiometrics
                ? Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET
                : undefined,
            authenticationPrompt: {
                title: promptTitle,
                description: promptDesc,
            },
            securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
        }
    }

    async setItem(key: string, value: Uint8Array): Promise<void> {
        await Keychain.setGenericPassword(
            'user',
            this.utf8decoder.decode(value),
            {
                ...this.baseOpts,
                service: `${this.baseOpts.service}.${key}`,
            },
        )
    }

    async getItem(key: string): Promise<Uint8Array | null> {
        const creds = await Keychain.getGenericPassword({
            ...this.baseOpts,
            service: `${this.baseOpts.service}.${key}`,
        })
        return creds ? this.utf8encoder.encode(creds.password) : null
    }

    async removeItem(key: string): Promise<void> {
        await Keychain.resetGenericPassword({
            ...this.baseOpts,
            service: `${this.baseOpts.service}.${key}`,
        })
    }

    async authenticate(): Promise<boolean> {
        //TODO implement me
        return true
    }
}

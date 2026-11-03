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

import { requireOptionalNativeModule } from 'expo'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    RemoteConfigKeys,
    type RemoteConfigService,
    type WidgetBackendPinning,
    type WidgetImageRequest,
    type WidgetsService,
} from '@perawallet/wallet-extension-platform'
import { buildPinningConfig } from './ssl-pinning/buildPinningConfig'
import { BACKEND_PIN_DOMAINS } from './ssl-pinning/pins'

const LOG_SOURCE = 'RNWidgetsService'

interface NativePeraWidgets {
    writeSnapshot(json: string): Promise<void>
    clearSnapshot(): Promise<void>
    syncImages(items: WidgetImageRequest[]): Promise<string[]>
    consumePendingScan(): Promise<boolean>
    addListener?(
        event: 'onScanRequested',
        listener: () => void,
    ): { remove(): void }
}

const getNativeModule = (): Nullable<NativePeraWidgets> =>
    requireOptionalNativeModule<NativePeraWidgets>('PeraWidgets')

// Widgets are a best-effort mirror of app state: a failed write must never
// surface to the app, so every call degrades to a no-op.
export class RNWidgetsService implements WidgetsService {
    constructor(
        private readonly remoteConfig: Pick<
            RemoteConfigService,
            'getBooleanValue'
        >,
    ) {}

    async writeSnapshot(json: string): Promise<void> {
        try {
            await getNativeModule()?.writeSnapshot(json)
        } catch (error) {
            logger.warn('writeSnapshot native call threw', {
                source: LOG_SOURCE,
                error,
            })
        }
    }

    async clearSnapshot(): Promise<void> {
        try {
            await getNativeModule()?.clearSnapshot()
        } catch (error) {
            logger.warn('clearSnapshot native call threw', {
                source: LOG_SOURCE,
                error,
            })
        }
    }

    async syncImages(items: WidgetImageRequest[]): Promise<string[]> {
        const module = getNativeModule()
        if (!module) return []
        try {
            return await module.syncImages(items)
        } catch (error) {
            logger.warn('syncImages native call threw', {
                source: LOG_SOURCE,
                error,
            })
            return []
        }
    }

    async consumePendingScan(): Promise<boolean> {
        const module = getNativeModule()
        if (!module) return false
        try {
            return await module.consumePendingScan()
        } catch (error) {
            logger.warn('consumePendingScan native call threw', {
                source: LOG_SOURCE,
                error,
            })
            return false
        }
    }

    onScanRequested(listener: () => void): () => void {
        const subscription = getNativeModule()?.addListener?.(
            'onScanRequested',
            listener,
        )
        return () => subscription?.remove()
    }

    // The same flag and host rule the app's own pinning uses, read live so the
    // remote kill switch reaches the widgets on their next snapshot.
    backendPinning(backendUrl: string): Nullable<WidgetBackendPinning> {
        try {
            if (
                !this.remoteConfig.getBooleanValue(
                    RemoteConfigKeys.enable_ssl_pinning_pera_api,
                    false,
                )
            ) {
                return null
            }
            const host = new URL(backendUrl).hostname
            const pins = buildPinningConfig(
                [backendUrl],
                BACKEND_PIN_DOMAINS,
            )?.[host]
            if (!pins) return null
            return {
                publicKeyHashes: pins.publicKeyHashes,
                // Second precision: Foundation's default ISO 8601 parser
                // rejects fractional seconds.
                expiresAt: new Date(pins.expirationDate)
                    .toISOString()
                    .replace(/\.\d{3}Z$/, 'Z'),
            }
        } catch (error) {
            logger.warn('backendPinning could not resolve the pin set', {
                source: LOG_SOURCE,
                error,
            })
            return null
        }
    }
}

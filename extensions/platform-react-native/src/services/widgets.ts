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
import type {
    WidgetImageRequest,
    WidgetsService,
} from '@perawallet/wallet-extension-platform'

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
}

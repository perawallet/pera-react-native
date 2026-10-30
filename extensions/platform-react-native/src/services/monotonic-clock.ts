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
    MonotonicClockService,
    MonotonicReading,
} from '@perawallet/wallet-extension-platform'

const LOG_SOURCE = 'RNMonotonicClockService'

interface NativePeraMonotonicClock {
    now(): { bootId: string; elapsedMs: number }
}

const isValidReading = (value: unknown): value is MonotonicReading => {
    if (typeof value !== 'object' || value === null) return false
    const { bootId, elapsedMs } = value as Record<string, unknown>
    return (
        typeof bootId === 'string' &&
        bootId.length > 0 &&
        typeof elapsedMs === 'number' &&
        Number.isFinite(elapsedMs) &&
        elapsedMs >= 0
    )
}

export class RNMonotonicClockService implements MonotonicClockService {
    // The lockout countdown reads the clock every second; one warning is enough.
    private hasWarnedMissing = false

    now(): Nullable<MonotonicReading> {
        const module =
            requireOptionalNativeModule<NativePeraMonotonicClock>(
                'PeraMonotonicClock',
            )
        if (!module) {
            if (!this.hasWarnedMissing) {
                this.hasWarnedMissing = true
                logger.warn('PeraMonotonicClock native module is missing', {
                    source: LOG_SOURCE,
                })
            }
            return null
        }
        try {
            const reading: unknown = module.now()
            if (isValidReading(reading)) {
                return { bootId: reading.bootId, elapsedMs: reading.elapsedMs }
            }
            logger.warn('PeraMonotonicClock returned a malformed reading', {
                source: LOG_SOURCE,
            })
            return null
        } catch (error) {
            logger.warn('PeraMonotonicClock native call threw', {
                source: LOG_SOURCE,
                error,
            })
            return null
        }
    }
}

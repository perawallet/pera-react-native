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
    MonotonicClockService,
    MonotonicReading,
} from '../monotonic-clock'

/** In-memory monotonic clock a test drives with `advance` and `reboot`. */
export class MemoryMonotonicClockService implements MonotonicClockService {
    private reading: MonotonicReading | null
    private boots = 1

    constructor(
        initial: MonotonicReading | null = { bootId: 'boot-1', elapsedMs: 0 },
    ) {
        this.reading = initial
    }

    now(): MonotonicReading | null {
        return this.reading ? { ...this.reading } : null
    }

    advance(ms: number): void {
        if (!this.reading) return
        this.reading = {
            ...this.reading,
            elapsedMs: this.reading.elapsedMs + ms,
        }
    }

    reboot(): void {
        this.boots += 1
        this.reading = { bootId: `boot-${this.boots}`, elapsedMs: 0 }
    }

    setUnavailable(): void {
        this.reading = null
    }
}

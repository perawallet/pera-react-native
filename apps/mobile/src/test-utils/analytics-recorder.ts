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

import { vi } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type RecordedAnalyticsEvent = {
    name: string
    payload: Record<string, unknown> | undefined
}

export interface AnalyticsRecorder {
    events(names?: readonly string[]): RecordedAnalyticsEvent[]
    restore(): void
}

const TESTNET_PREFIX = 't_'

/**
 * Records what reaches the harness's analytics service. The testnet prefix is
 * stripped so tables of event names hold in every network mode.
 */
export const recordAnalyticsEvents = (): AnalyticsRecorder => {
    const spy = vi.spyOn(getProvider().analytics, 'logEvent')

    return {
        events: names =>
            spy.mock.calls
                .map(([name, payload]) => ({
                    name: name.startsWith(TESTNET_PREFIX)
                        ? name.slice(TESTNET_PREFIX.length)
                        : name,
                    // The trackers only ever log an object payload or none.
                    payload: payload as RecordedAnalyticsEvent['payload'],
                }))
                .filter(event => !names || names.includes(event.name)),
        restore: () => spy.mockRestore(),
    }
}

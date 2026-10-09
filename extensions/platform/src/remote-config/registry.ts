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

import { RemoteConfigDefaults, type RemoteConfigValue } from './models'

export type RemoteConfigDefaultsMap = Readonly<
    Record<string, RemoteConfigValue>
>

export class DuplicateRemoteConfigKeyError extends Error {
    readonly key: string

    constructor(key: string) {
        super(
            `Remote config key "${key}" is already declared with another default`,
        )
        this.name = 'DuplicateRemoteConfigKeyError'
        this.key = key
    }
}

/**
 * The bundled defaults every remote-config service seeds. Seeding matters: an
 * unseeded key reads back as the SDK's static value (0 for a number), not the
 * caller's fallback, so a key another package reads must be declared here
 * before the service initializes.
 */
export interface RemoteConfigDefaultsRegistry {
    /** Same key and value again is a no-op, so a repeated bootstrap stays safe. */
    declare(defaults: RemoteConfigDefaultsMap): void
    all(): RemoteConfigDefaultsMap
    /** Test-only: drops every declaration. */
    reset(): void
}

export const createRemoteConfigDefaultsRegistry =
    (): RemoteConfigDefaultsRegistry => {
        let declared: Record<string, RemoteConfigValue> = {}

        const all = (): RemoteConfigDefaultsMap => ({
            ...RemoteConfigDefaults,
            ...declared,
        })

        return {
            declare: defaults => {
                const current = all()
                for (const [key, value] of Object.entries(defaults)) {
                    if (key in current && current[key] !== value) {
                        throw new DuplicateRemoteConfigKeyError(key)
                    }
                }
                declared = { ...declared, ...defaults }
            },
            all,
            reset: () => {
                declared = {}
            },
        }
    }

export const remoteConfigDefaultsRegistry = createRemoteConfigDefaultsRegistry()

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

import { assertType, describe, expectTypeOf, it } from 'vitest'
import type {
    ChainCapabilities,
    ChainContext,
    ChainDescriptor,
    ChainModule,
} from '../../index'

declare const descriptor: ChainDescriptor
declare const capabilityDefaults: ChainCapabilities

const register = (_ctx: ChainContext): void => undefined
const i18nKeys = (): readonly string[] => []

describe('ChainModule', () => {
    it('accepts a complete module', () => {
        assertType<ChainModule>({
            descriptor,
            capabilityDefaults,
            register,
            i18nKeys,
        })
    })

    it('accepts restrictions for developer modes only', () => {
        assertType<ChainModule>({
            descriptor,
            capabilityDefaults,
            capabilityRestrictions: { onramp: ['developer-override'] },
            register,
            i18nKeys,
        })
        assertType<ChainModule>({
            descriptor,
            capabilityDefaults,
            // @ts-expect-error live can't be restricted
            capabilityRestrictions: { onramp: ['live'] },
            register,
            i18nKeys,
        })
    })

    it('rejects a module without capabilityDefaults', () => {
        // @ts-expect-error capabilityDefaults is required
        assertType<ChainModule>({ descriptor, register, i18nKeys })
    })

    it('rejects a module without register', () => {
        // @ts-expect-error register is required
        assertType<ChainModule>({ descriptor, capabilityDefaults, i18nKeys })
    })

    it('rejects a module without descriptor or i18nKeys', () => {
        // @ts-expect-error descriptor is required
        assertType<ChainModule>({ capabilityDefaults, register, i18nKeys })
        // @ts-expect-error i18nKeys is required
        assertType<ChainModule>({ descriptor, capabilityDefaults, register })
    })

    it('passes a ChainContext to register', () => {
        expectTypeOf<
            Parameters<ChainModule['register']>[0]
        >().toEqualTypeOf<ChainContext>()
    })

    it('widens a module with typed endpoints to the default', () => {
        expectTypeOf<ChainModule<{ algod: string }>>().toExtend<ChainModule>()
    })
})

describe('ChainContext', () => {
    it('exposes only the scope, endpoints, http client and key store', () => {
        expectTypeOf<keyof ChainContext>().toEqualTypeOf<
            'getScope' | 'getEndpoints' | 'http' | 'kms'
        >()
    })
})

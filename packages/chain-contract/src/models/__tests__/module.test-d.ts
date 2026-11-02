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
    ChainCapability,
    ChainContext,
    ChainDescriptor,
    ChainModule,
} from '../../index'

declare const descriptor: ChainDescriptor
declare const capabilityDefaults: ChainCapabilities
declare const supportedCapabilities: readonly ChainCapability[]

const register = (_ctx: ChainContext): void => undefined

describe('ChainModule', () => {
    it('accepts a complete module', () => {
        assertType<ChainModule>({
            descriptor,
            capabilityDefaults,
            supportedCapabilities,
            register,
        })
    })

    it('accepts restrictions for developer modes only', () => {
        assertType<ChainModule>({
            descriptor,
            capabilityDefaults,
            supportedCapabilities,
            capabilityRestrictions: { onramp: ['developer-override'] },
            register,
        })
        assertType<ChainModule>({
            descriptor,
            capabilityDefaults,
            supportedCapabilities,
            // @ts-expect-error live can't be restricted
            capabilityRestrictions: { onramp: ['live'] },
            register,
        })
    })

    it('rejects a module without capabilityDefaults', () => {
        // @ts-expect-error capabilityDefaults is required
        assertType<ChainModule>({
            descriptor,
            supportedCapabilities,
            register,
        })
    })

    it('rejects a module without register', () => {
        // @ts-expect-error register is required
        assertType<ChainModule>({
            descriptor,
            capabilityDefaults,
            supportedCapabilities,
        })
    })

    it('rejects a module without supportedCapabilities', () => {
        // @ts-expect-error supportedCapabilities is required
        assertType<ChainModule>({ descriptor, capabilityDefaults, register })
    })

    it('rejects a module without descriptor', () => {
        // @ts-expect-error descriptor is required
        assertType<ChainModule>({
            capabilityDefaults,
            supportedCapabilities,
            register,
        })
    })

    it('passes a ChainContext to register', () => {
        expectTypeOf<
            Parameters<ChainModule['register']>[0]
        >().toEqualTypeOf<ChainContext>()
    })

    it('takes no type parameter', () => {
        // @ts-expect-error ChainModule is not generic
        assertType<ChainModule<{ algod: string }>>({} as ChainModule)
    })
})

describe('ChainContext', () => {
    it('takes no type parameter', () => {
        // @ts-expect-error ChainContext is not generic
        assertType<ChainContext<{ algod: string }>>({} as ChainContext)
    })

    it('exposes only the scope, endpoints, Pera backend, timeouts and key store', () => {
        expectTypeOf<keyof ChainContext>().toEqualTypeOf<
            'getScope' | 'getEndpoints' | 'getPeraBackend' | 'timeouts' | 'kms'
        >()
    })
})

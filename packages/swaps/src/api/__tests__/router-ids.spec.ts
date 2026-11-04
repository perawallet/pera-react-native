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

import { describe, expect, test } from 'vitest'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import {
    routerAccountId,
    routerAssetIdOf,
    scopeOfRouterChain,
    swapAssetRefOf,
} from '../router-ids'
import { registerSecondFakeSwapAdapter } from '../../__tests__/fakeSwapAdapter'
import { SCOPE_A, SCOPE_B } from './routerFixtures'

describe('router ids', () => {
    test('round-trips an asset through its router id', () => {
        const ref = { ...SCOPE_A, assetId: '31566704' }

        const routerId = routerAssetIdOf(ref)

        expect(routerId).toBe('fake-a:main/token:31566704')
        expect(swapAssetRefOf(routerId)).toEqual(ref)
    })

    test('reads an unknown router chain as null', () => {
        expect(swapAssetRefOf('nope:1/token:1')).toBeNull()
        expect(scopeOfRouterChain('nope:1')).toBeNull()
    })

    test('reads a chain with no swap adapter as null', () => {
        expect(swapAssetRefOf('fake-b:main/token:usdc')).toBeNull()
    })

    test('reads a second swap chain once its adapter registers', () => {
        registerSecondFakeSwapAdapter()

        expect(swapAssetRefOf('fake-b:main/token:usdc')).toEqual({
            ...SCOPE_B,
            assetId: 'usdc',
        })
    })

    test('builds a router account id from the scope', () => {
        expect(routerAccountId(SCOPE_A, 'ADDR')).toBe('fake-a:main:ADDR')
    })

    test('refuses a network the router has no id for', () => {
        expect(() =>
            routerAccountId({ chainId: 'algorand', networkId: 'custom' }, 'A'),
        ).toThrow(PeraServiceUnavailableError)
    })
})

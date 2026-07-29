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

import { describe, test, expect } from 'vitest'
import { Networks } from '../models/network'
import {
    PERA_SERVICE_FALLBACK,
    hasPeraServiceFallback,
    resolvePeraServiceLane,
    resolvePeraServiceNetwork,
} from '../pera-service-fallback'

describe('pera-service-fallback', () => {
    test('maps exactly betanet and custom to testnet', () => {
        expect(PERA_SERVICE_FALLBACK).toEqual({
            betanet: Networks.testnet,
            custom: Networks.testnet,
        })
    })

    test('leaves the two Pera-backed networks untouched', () => {
        expect(resolvePeraServiceNetwork(Networks.mainnet)).toBe(
            Networks.mainnet,
        )
        expect(resolvePeraServiceNetwork(Networks.testnet)).toBe(
            Networks.testnet,
        )
        expect(hasPeraServiceFallback(Networks.mainnet)).toBe(false)
        expect(hasPeraServiceFallback(Networks.testnet)).toBe(false)
    })

    test('resolves the two fallback networks to testnet', () => {
        for (const network of [Networks.betanet, Networks.custom] as const) {
            expect(resolvePeraServiceNetwork(network)).toBe(Networks.testnet)
            expect(resolvePeraServiceLane(network)).toBe(Networks.testnet)
            expect(hasPeraServiceFallback(network)).toBe(true)
        }
    })

    test('lane is only ever one of the two Pera lanes', () => {
        for (const network of Object.values(Networks)) {
            expect([Networks.mainnet, Networks.testnet]).toContain(
                resolvePeraServiceLane(network),
            )
        }
    })
})

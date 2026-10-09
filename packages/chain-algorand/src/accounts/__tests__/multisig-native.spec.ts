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

import { describe, expect, it } from 'vitest'
import { algorandMultisigNative } from '../multisig-native'

const PARAMETERS = { version: 1, threshold: 2, addresses: ['P1', 'P2'] }

describe('algorandMultisigNative', () => {
    it('stores the parameters beside the post-quantum key the entry holds', () => {
        const pq = { scheme: 'falcon-1024' as const, publicKey: 'cGs=' }

        const native = algorandMultisigNative.withParameters(
            { family: 'algorand', pq },
            PARAMETERS,
        )

        expect(native).toEqual({ family: 'algorand', pq, multisig: PARAMETERS })
        expect(algorandMultisigNative.parametersOf(native)).toEqual(PARAMETERS)
    })

    it('copies the participant list rather than sharing it', () => {
        const native = algorandMultisigNative.withParameters(
            undefined,
            PARAMETERS,
        )

        expect(native.multisig?.addresses).not.toBe(PARAMETERS.addresses)
        expect(algorandMultisigNative.parametersOf(native)?.addresses).not.toBe(
            native.multisig?.addresses,
        )
    })

    it('reads none from an entry without parameters', () => {
        expect(algorandMultisigNative.parametersOf(undefined)).toBeUndefined()
        expect(
            algorandMultisigNative.parametersOf({ family: 'algorand' }),
        ).toBeUndefined()
    })
})

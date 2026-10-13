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
import {
    addressCodecs,
    keyDerivations,
    type AddressCodec,
    type ChainAdapterRegistry,
    type ChainKeyStore,
    type DerivedKey,
    type KeyDerivation,
    type KeyDerivationRequest,
    type KeyImportRequest,
} from '../../index'

const derivedKey: DerivedKey = {
    keyPairId: 'key-1',
    publicKey: new Uint8Array(32),
}

describe('registries', () => {
    it('are typed to their contract', () => {
        expectTypeOf(addressCodecs).toEqualTypeOf<
            ChainAdapterRegistry<AddressCodec>
        >()
        expectTypeOf(keyDerivations).toEqualTypeOf<
            ChainAdapterRegistry<KeyDerivation>
        >()
    })
})

describe('AddressCodec', () => {
    it('rejects an implementation without chainId', () => {
        // @ts-expect-error chainId keys the registry
        assertType<AddressCodec>({
            fromPublicKey: () => '',
            isValid: () => true,
            normalize: (address: string) => address,
            areEqual: () => true,
            toPaymentUri: () => '',
            parsePaymentUri: () => undefined,
        })
    })
})

describe('KeyDerivation', () => {
    it('resolves deriveAccount to a key pair id, public key and address', () => {
        type Derived = Awaited<ReturnType<KeyDerivation['deriveAccount']>>

        // Keys plus assignability: toEqualTypeOf's deep brand can't compare Uint8Array.
        expectTypeOf<keyof Derived>().toEqualTypeOf<
            'keyPairId' | 'publicKey' | 'address'
        >()
        expectTypeOf<Derived>().toExtend<{
            keyPairId: string
            publicKey: Uint8Array
            address: string
        }>()
    })

    it('resolves importRawKey to a key pair id and address', () => {
        expectTypeOf<
            Awaited<ReturnType<KeyDerivation['importRawKey']>>
        >().toEqualTypeOf<{ keyPairId: string; address: string }>()
    })
})

describe('ChainKeyStore', () => {
    it('takes the domain as the last parameter of every method', () => {
        type LastParam<F extends (...args: never[]) => unknown> =
            Parameters<F> extends [...unknown[], infer L] ? L : never

        expectTypeOf<
            LastParam<ChainKeyStore['deriveFromSeed']>
        >().toEqualTypeOf<string>()
        expectTypeOf<
            LastParam<ChainKeyStore['importRawKey']>
        >().toEqualTypeOf<string>()
        expectTypeOf<LastParam<ChainKeyStore['sign']>>().toEqualTypeOf<string>()
    })

    it('rejects a key store without sign', () => {
        // @ts-expect-error sign is required
        assertType<ChainKeyStore>({
            deriveFromSeed: async () => derivedKey,
            importRawKey: async () => derivedKey,
        })
    })
})

describe('key requests', () => {
    it('require an id', () => {
        // @ts-expect-error the chain names every key id
        assertType<KeyDerivationRequest>({ scheme: 'ed25519', path: "m/44'" })
        // @ts-expect-error the chain names every key id
        assertType<KeyImportRequest>({ scheme: 'ed25519' })
    })

    it('accept object-valued derivation params', () => {
        assertType<KeyDerivationRequest>({
            scheme: 'ed25519',
            path: "m/44'/283'/0'/0/0",
            id: 'key-1',
            params: { mode: 'peikert', metadata: { account: 0 } },
        })
    })
})

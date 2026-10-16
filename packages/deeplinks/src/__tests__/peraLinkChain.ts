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

import {
    addressCodecs,
    type AddressCodec,
} from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@perawallet/wallet-core-chain-contract/testing'
import { deeplinkAdapters } from '../chain-adapter'
import { PERA_LINK_CHAIN_ID } from '../pera-link-chain'
import { fakeDeeplinkAdapter } from './fakeDeeplinkAdapter'

// 58 base32 characters: the shape of the addresses the Pera-link specs spell.
const isBase32Address = (address: string): boolean =>
    /^[A-Z2-7]{58}$/.test(address)

/** Registers a codec and an adapter under the Pera-link chain; callers reset both registries afterwards. */
export const registerPeraLinkChain = (
    isValid: AddressCodec['isValid'] = isBase32Address,
): void => {
    const codec: AddressCodec = {
        ...fixtureCodec,
        chainId: PERA_LINK_CHAIN_ID,
        isValid,
    }
    addressCodecs.register(codec)
    deeplinkAdapters.register(
        fakeDeeplinkAdapter(PERA_LINK_CHAIN_ID, ['peralinkfixture'], codec),
    )
}

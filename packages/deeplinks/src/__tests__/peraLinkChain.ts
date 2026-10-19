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

import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    addressCodecs,
    type AddressCodec,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
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

export const PERA_LINK_MAINNET_CAIP2 =
    'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
export const PERA_LINK_TESTNET_CAIP2 =
    'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe'
export const EVM_LINK_CHAIN_ID = 'ethereum' as ChainId
export const EVM_LINK_CAIP2 = 'eip155:1'

const isHexAddress = (value: string): boolean =>
    /^0x[0-9a-fA-F]{40}$/.test(value)

const NO_CAPABILITIES = {} as ChainCapabilities

// byCaip2 reads only `id` and `networks`, so the rest of the descriptor is left out.
const linkDescriptor = (
    id: ChainId,
    networks: readonly { id: string; caip2: string }[],
): ChainDescriptor => ({ id, networks }) as unknown as ChainDescriptor

/**
 * Registers the Pera-link chain plus a 0x-address chain, both with CAIP-2
 * networks; callers reset the codec, adapter and chain registries afterwards.
 */
export const registerPeraLinkChains = (): void => {
    registerPeraLinkChain()

    const evmCodec: AddressCodec = {
        ...fixtureCodec,
        chainId: EVM_LINK_CHAIN_ID,
        isValid: isHexAddress,
    }
    addressCodecs.register(evmCodec)
    deeplinkAdapters.register({
        ...fakeDeeplinkAdapter(EVM_LINK_CHAIN_ID, ['evmfixture'], evmCodec),
        toAssetRef: raw =>
            isHexAddress(raw)
                ? { chainId: EVM_LINK_CHAIN_ID, assetId: raw }
                : undefined,
    })

    const { chains } = getProvider()
    chains.register(
        linkDescriptor(PERA_LINK_CHAIN_ID, [
            { id: 'mainnet', caip2: PERA_LINK_MAINNET_CAIP2 },
            { id: 'testnet', caip2: PERA_LINK_TESTNET_CAIP2 },
        ]),
        NO_CAPABILITIES,
    )
    chains.register(
        linkDescriptor(EVM_LINK_CHAIN_ID, [
            { id: 'mainnet', caip2: EVM_LINK_CAIP2 },
        ]),
        NO_CAPABILITIES,
    )
}

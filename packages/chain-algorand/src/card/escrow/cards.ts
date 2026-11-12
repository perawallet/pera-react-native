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

import { ABIType, decodeAddress } from 'algosdk'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { cardAlgorandClient } from '../client'
import { algorandCardConfig } from '../config'
import { isAlgodNotFoundError } from './algod'
import mainArc56 from './main-arc56.json'
import { type AlgorandNetworkId } from '../../network-id'

const MAIN_SPEC = mainArc56 as unknown as Arc56Contract

// W3Card's `CardData` struct: owner, card address, nonce, withdrawal nonce.
const CARD_DATA_TYPE = ABIType.from('(address,address,uint64,uint64)')
type CardDataTuple = [string, string, bigint, bigint]

// Taken from the spec so a renamed box map fails loudly at decode time.
const CARDS_PREFIX = Uint8Array.from(
    atob(MAIN_SPEC.state.maps.box.cards.prefix ?? ''),
    char => char.charCodeAt(0),
)

const buildCardBoxName = (cardAddress: string): Uint8Array => {
    const name = new Uint8Array(CARDS_PREFIX.length + 32)
    name.set(CARDS_PREFIX, 0)
    name.set(decodeAddress(cardAddress).publicKey, CARDS_PREFIX.length)
    return name
}

/**
 * The account that owns `cardAddress` on W3Card. Null when it is no card, or
 * the network has no W3Card deployment.
 */
export const getAlgorandCardOwner = async (
    network: AlgorandNetworkId,
    cardAddress: string,
): Promise<Nullable<string>> => {
    const { mainAppId } = algorandCardConfig(network)
    if (!mainAppId) return null
    try {
        const box = await cardAlgorandClient(network)
            .client.algod.getApplicationBoxByName(
                BigInt(mainAppId),
                buildCardBoxName(cardAddress),
            )
            .do()
        const [owner] = CARD_DATA_TYPE.decode(box.value) as CardDataTuple
        return owner
    } catch (error) {
        if (isAlgodNotFoundError(error)) return null
        throw error
    }
}

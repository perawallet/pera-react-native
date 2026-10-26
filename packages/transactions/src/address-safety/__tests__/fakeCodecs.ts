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

import type {
    AddressCodec,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'

const shortForm = (address: string): string =>
    `${address.slice(0, 4)}...${address.slice(-4)}`

/** A strict codec like Algorand's, or a case-blind one like EVM's. */
export const fakeCodec = (
    chainId: ChainId,
    { isCaseBlind }: { isCaseBlind: boolean },
): AddressCodec => {
    const fold = (address: string) =>
        isCaseBlind ? address.toLowerCase() : address
    const areEqual = (a: string, b: string) => fold(a) === fold(b)
    return {
        chainId,
        fromPublicKey: () => '',
        isValid: () => true,
        normalize: address => address,
        areEqual,
        truncate: shortForm,
        resembles: (a, b) =>
            !areEqual(a, b) && fold(shortForm(a)) === fold(shortForm(b)),
        toPaymentUri: address => address,
        parsePaymentUri: () => undefined,
    }
}

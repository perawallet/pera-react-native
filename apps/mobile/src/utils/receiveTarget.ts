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
    addressOn,
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type ReceiveTarget = {
    /** The account's display name on its receive chain. */
    accountName: string
    /** The receive address in its chain's canonical form. */
    address: string
    /** What a receive QR encodes: the chain codec's payment URI for `address`. */
    paymentUri: string
}

/**
 * Where `account` receives on `scope`, its receive chain at that chain's
 * selected network. Null when there is no scope, no codec is registered for
 * the chain, or the account has no valid address there. Shared by the Receive
 * screen and the Receive QR widget so both encode the same QR.
 */
export const receiveTargetOf = (
    account: WalletAccount,
    scope: Nullable<ChainScope>,
): Nullable<ReceiveTarget> => {
    if (!scope || !addressCodecs.has(scope.chainId)) return null
    const codec = addressCodecs.get(scope.chainId)
    const rawAddress = addressOn(account, scope)
    // normalize is only defined for input that passes isValid.
    if (!rawAddress || !codec.isValid(rawAddress, scope.networkId)) return null
    const address = codec.normalize(rawAddress)
    return {
        accountName: getAccountDisplayName(account, scope.chainId),
        address,
        paymentUri: codec.toPaymentUri(address, { networkId: scope.networkId }),
    }
}

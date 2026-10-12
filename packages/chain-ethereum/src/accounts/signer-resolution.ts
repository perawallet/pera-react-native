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
    canSignDirectly,
    type SignerResolution,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

// Ethereum has no rekey and no native multisig, so an account signs for
// itself or not at all.
export const resolveEthereumSigner = (
    account: WalletAccount,
): SignerResolution =>
    canSignDirectly(account)
        ? { kind: 'ok', signer: account }
        : { kind: 'watch', account }

export const getEthereumAuthAccount = (account: WalletAccount): WalletAccount =>
    account

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

import type { AccountsChainAdapter } from '@perawallet/wallet-core-accounts'
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import { createEthereumAccountStateOps } from './account-state'
import { assertEthereumBip44PathMatches } from './bip44'
import { toEthereumChainState } from './chain-state'
import { ethereumHdKeyId } from './hd-derivation'
import { ethereumLegacyDetails } from './legacy-details'
import { revealEthereumPrivateKey } from './private-key'
import {
    getEthereumAuthAccount,
    resolveEthereumSigner,
} from './signer-resolution'

// No createPublicKeyGetter: secp256k1 keys derive only inside the keystore,
// never from an in-memory root. No AccountInformation: it is Algorand-shaped.
export const createEthereumAccountsAdapter = (
    ctx: ChainContext,
): AccountsChainAdapter => ({
    ...createEthereumAccountStateOps(ctx),
    toChainState: toEthereumChainState,
    hdKeyPairId: (seedKeyId, { account, keyIndex }) =>
        ethereumHdKeyId(seedKeyId, account, keyIndex),
    assertHdPathMatches: assertEthereumBip44PathMatches,
    legacyDetails: ethereumLegacyDetails,
    revealPrivateKey: revealEthereumPrivateKey,
    resolveSigner: resolveEthereumSigner,
    getAuthAccount: getEthereumAuthAccount,
})

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
import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { fetchAlgorandAccountState } from './account-state'
import { assertAlgorandBip44PathMatches } from './bip44'
import { ALGORAND_HD_DERIVATION_TYPE } from './constants'
import {
    algorandAccountExists,
    checkAlgorandActivity,
    createXHDGetPublicKey,
    fetchAlgorandRekeyedAddresses,
} from './discovery'
import { fetchAccountInformation, fetchAssetOptInRounds } from './information'
import { algorandNetworkOf } from '../legacy-network'
import { algorandQuantumDerivation } from './quantum'

export const algorandAccountsAdapter: AccountsChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    hdDerivationType: ALGORAND_HD_DERIVATION_TYPE,
    fetchAccountState: (address, scope, hint) =>
        fetchAlgorandAccountState(address, algorandNetworkOf(scope), hint),
    fetchAccountInformation: (address, scope) =>
        fetchAccountInformation(address, algorandNetworkOf(scope)),
    fetchAssetOptInRounds: (address, scope) =>
        fetchAssetOptInRounds(address, algorandNetworkOf(scope)),
    accountExists: (address, scope) =>
        algorandAccountExists(address, algorandNetworkOf(scope)),
    checkActivity: (addresses, scope) =>
        checkAlgorandActivity(addresses, algorandNetworkOf(scope)),
    createPublicKeyGetter: createXHDGetPublicKey,
    assertHdPathMatches: assertAlgorandBip44PathMatches,
    quantum: algorandQuantumDerivation,
    deriveMultisigAddress: ({ version, threshold, addresses }) =>
        generateMultisigAddress(version, threshold, addresses),
    fetchRekeyedAddresses: (authAddress, scope) =>
        fetchAlgorandRekeyedAddresses(authAddress, algorandNetworkOf(scope)),
}

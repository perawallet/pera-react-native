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
    accountPresentationChainAdapters,
    accountsChainAdapters,
    useAccountChainStateStore,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    algorandAccountPresentation,
    algorandAccountsAdapter,
    algorandAddressCodec,
} from '@perawallet/wallet-core-chain-algorand/accounts'
import { algorandDeviceAdapter } from '@perawallet/wallet-core-chain-algorand/device'
import { algorandMultisigAdapter } from '@perawallet/wallet-core-chain-algorand/multisig'
import { deviceChainAdapters } from '@perawallet/wallet-core-device'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'

// Unit specs skip the app bootstrap, so signer resolution and account copy
// over real accounts have no adapter unless a spec registers one.
export const registerAlgorandAccountsAdapter = (): void => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
    accountPresentationChainAdapters.reset()
    accountPresentationChainAdapters.register(algorandAccountPresentation)
}

/** Registers Algorand accounts with the devices API the way the app bootstrap does. */
export const registerAlgorandDeviceAdapter = (): void => {
    deviceChainAdapters.reset()
    deviceChainAdapters.register(algorandDeviceAdapter)
}

/** Lets `getAccountDisplayName` truncate an unnamed account's address as the app does. */
export const registerAlgorandAddressCodec = (): void => {
    if (!addressCodecs.has(algorandAddressCodec.chainId)) {
        addressCodecs.register(algorandAddressCodec)
    }
}

/** Lets a multisig fixture's address derive from its parameters. */
export const registerAlgorandMultisigAdapter = (): void => {
    multisigChainAdapters.reset()
    multisigChainAdapters.register(algorandMultisigAdapter)
}

/**
 * Records `authorityAddress` as `address`'s authority on `scope` (default: the
 * selected network, which is what the readers ask) the way the syncer does;
 * `null` is an observed "signs for itself".
 */
export const seedAuthority = (
    address: string,
    authorityAddress: string | null,
    scope: ChainScope = getSelectedScope(LEGACY_CHAIN_ID),
): void =>
    useAccountChainStateStore
        .getState()
        .setAccountChainState(
            scope,
            address,
            algorandAccountsAdapter.toChainState({ authorityAddress }),
        )

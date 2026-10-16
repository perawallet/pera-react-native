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
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    useAccountScope,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'

/**
 * The chain a send runs on: the selected account's own, at that chain's
 * selected network. There is no chain picker, so switching the selected
 * account is what moves the flow to another chain.
 */
export const useSendScope = (): ChainScope =>
    useAccountScope(useSelectedAccount(), LEGACY_CHAIN_ID)

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
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useAccountChainStateStore } from '../store/accountChainState'

/**
 * True once a read of the account on `scope` has succeeded, in this run or an
 * earlier one: the chain-state row is written only after a read lands and is
 * refilled from SQLite at startup. Holdings stored before then are placeholders.
 */
export const useHasAccountChainState = (
    scope: ChainScope,
    address: string,
): boolean =>
    useAccountChainStateStore(
        state => state.states[toScopeKey(scope)]?.[address] !== undefined,
    )

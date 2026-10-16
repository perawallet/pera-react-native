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
    CannotSignError,
    SigningError,
    type LocalKeySignerChainAdapter,
} from '@perawallet/wallet-core-signing'
import { ETHEREUM_CHAIN_ID } from '../chain-id'

const REASON =
    'Ethereum signs through its transaction planner and message signer, not the local-key strategy'

const unsupported = (): Promise<never> =>
    Promise.reject(new SigningError(REASON, undefined, { retryable: false }))

// The legs take Algorand-shaped transactions and groups, which Ethereum can't
// express, so a request that reaches them is refused instead of signed.
export const ethereumLocalKeySignerAdapter: LocalKeySignerChainAdapter = {
    chainId: ETHEREUM_CHAIN_ID,
    signTransactions: unsupported,
    createStrategy: () => ({
        canSign: () => false,
        sign: (_group, account) =>
            Promise.reject(new CannotSignError(account.id, REASON)),
    }),
    signGroups: unsupported,
}

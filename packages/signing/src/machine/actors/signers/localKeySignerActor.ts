/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { fromPromise } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { AnalyzedSignableGroup, SigningResult } from '../../../pipeline/types'
import {
    createLocalKeyStrategy,
    type LocalSigningFunction,
} from '../../../pipeline/signing/createLocalKeyStrategy'

export type LocalKeySignerActorInput = {
    group: AnalyzedSignableGroup
    signerAccount: WalletAccount
    signTransactions: LocalSigningFunction
}

/**
 * XState actor that signs a transaction group using local keys (Algo25 / HDWallet).
 * Wraps createLocalKeyStrategy from the pipeline as a fromPromise actor.
 */
export const localKeySignerActor = fromPromise<SigningResult, LocalKeySignerActorInput>(
    async ({ input }) => {
        const { group, signerAccount, signTransactions } = input
        const strategy = createLocalKeyStrategy(signTransactions)
        return strategy.sign(group, signerAccount)
    },
)

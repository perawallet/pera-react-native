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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useCallback } from 'react'
import {
    canSignProgram,
    chainAccountOf,
    signingKeyOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import { plannerAdapterForScope } from '../chain-adapter'
import { SIGNING_KEY_DOMAIN } from '../constants'

/** The account cannot sign a program (hardware/watch/multisig/rekeyed). */
export class ProgramSigningUnsupportedError extends AppError {
    constructor(address: string) {
        super(`Cannot sign a program with ${address}`, {
            category: ErrorCategory.ACCOUNTS,
            recoverable: false,
        })
        this.name = 'ProgramSigningUnsupportedError'
    }
}

export const useProgramSigner = (scope: ChainScope) => {
    const { signDataWithKey } = useKMS()

    /** Signs the program payload for `program` with the account's own key. */
    const signProgram = useCallback(
        async (
            account: WalletAccount,
            program: Uint8Array,
        ): Promise<Uint8Array> => {
            // A program signature is verified against the sender's on-chain
            // auth account: hardware/watch have no program-signing path, and a
            // rekeyed account's own key would be rejected at draw time
            // (signing via the auth account is deferred — see canSignProgram).
            // The signing-key re-check only narrows the type.
            const keyPairId = signingKeyOn(account, scope.chainId)
            if (!canSignProgram(account, scope.chainId) || !keyPairId) {
                throw new ProgramSigningUnsupportedError(
                    chainAccountOf(account, scope.chainId)?.address ?? '',
                )
            }
            const [sig] = await signDataWithKey(keyPairId, SIGNING_KEY_DOMAIN, [
                plannerAdapterForScope(scope).programPayload(program),
            ])
            return sig
        },
        [signDataWithKey, scope],
    )

    return { signProgram }
}

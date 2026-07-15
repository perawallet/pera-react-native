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

import { useCallback } from 'react'
import { canSignArbitraryData } from '@perawallet/wallet-core-accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { concatBytes } from '@perawallet/wallet-core-shared'
import { SIGNING_KEY_DOMAIN } from '../constants'
import { encodeDelegatedLsig } from '../utils/lsig'

const PROGRAM_PREFIX = new TextEncoder().encode('Program')

/** The account cannot produce a delegated LSig (hardware/watch/rekeyed). */
export class ProgramSigningUnsupportedError extends Error {
    constructor(address: string) {
        super(`Cannot sign a program with ${address}`)
        this.name = 'ProgramSigningUnsupportedError'
    }
}

export const useProgramSigner = () => {
    const { signDataWithKey } = useKMS()

    /** ed25519 over `"Program" || program` with the account's own key. */
    const signProgram = useCallback(
        async (
            account: WalletAccount,
            program: Uint8Array,
        ): Promise<Uint8Array> => {
            // Delegated LSigs are verified against this account's own pubkey,
            // and hardware/watch accounts have no local raw-byte signing.
            if (!canSignArbitraryData(account) || !account.keyPairId) {
                throw new ProgramSigningUnsupportedError(account.address)
            }
            const [sig] = await signDataWithKey(
                account.keyPairId,
                SIGNING_KEY_DOMAIN,
                [concatBytes(PROGRAM_PREFIX, program)],
            )
            return sig
        },
        [signDataWithKey],
    )

    /** Signs and msgpack-encodes the full delegated LogicSig payload. */
    const signDelegatedLsig = useCallback(
        async (
            account: WalletAccount,
            program: Uint8Array,
        ): Promise<{ signedProgram: Uint8Array }> => {
            const sig = await signProgram(account, program)
            return { signedProgram: encodeDelegatedLsig(program, sig) }
        },
        [signProgram],
    )

    return { signProgram, signDelegatedLsig }
}

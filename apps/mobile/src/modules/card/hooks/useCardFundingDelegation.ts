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
import { Decimal } from 'decimal.js'
import {
    AUTO_FUNDING_PER_TX_LIMIT_USD,
    useUpdateCardFundingDelegationMutation,
} from '@perawallet/wallet-core-card'
import {
    canSignProgram,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    ProgramSigningUnsupportedError,
    useProgramSigner,
} from '@perawallet/wallet-core-signing'

const ZERO_ALLOWANCE = new Decimal(0)

export type UseCardFundingDelegationResult = {
    /** Signs + posts a delegation for `account`, replacing any previous one. */
    delegateTo: (account: WalletAccount) => Promise<void>
    /** Allowance-0 delegation — Baanx's only cancel mechanism (no DELETE). */
    cancelDelegation: (account: WalletAccount) => Promise<void>
    isPending: boolean
    /** False for hardware/watch/rekeyed accounts — gates the Auto option. */
    canDelegate: (account: WalletAccount) => boolean
}

/** Composes the program signer with the Baanx delegation mutation. */
export const useCardFundingDelegation = (): UseCardFundingDelegationResult => {
    const { signDelegatedLsig } = useProgramSigner()
    const updateDelegation = useUpdateCardFundingDelegationMutation()
    const { mutateAsync: updateDelegationAsync } = updateDelegation

    const canDelegate = useCallback(
        (account: WalletAccount) => canSignProgram(account),
        [],
    )

    const submit = useCallback(
        async (account: WalletAccount, allowance: Decimal) => {
            // Fail before any network call so nothing is half-applied.
            if (!canDelegate(account)) {
                throw new ProgramSigningUnsupportedError(account.address)
            }
            await updateDelegationAsync({
                address: account.address,
                allowance,
                signDelegation: program => signDelegatedLsig(account, program),
            })
        },
        [canDelegate, updateDelegationAsync, signDelegatedLsig],
    )

    const delegateTo = useCallback(
        (account: WalletAccount) =>
            submit(account, AUTO_FUNDING_PER_TX_LIMIT_USD),
        [submit],
    )

    const cancelDelegation = useCallback(
        (account: WalletAccount) => submit(account, ZERO_ALLOWANCE),
        [submit],
    )

    return {
        delegateTo,
        cancelDelegation,
        isPending: updateDelegation.isPending,
        canDelegate,
    }
}

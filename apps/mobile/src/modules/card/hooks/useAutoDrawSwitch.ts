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

import { useCallback, useState } from 'react'
import { useCardAutoDraw } from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { canAutoFund } from './useCardFundingSourcePicker'
import { useCardScope } from './useCardScope'

export type UseAutoDrawSwitchResult = {
    /**
     * Turns auto-funding ON for an already-created card: registers the signed
     * delegation, then switches auto-draw on chain with the fees sponsored, so
     * the funding account needs none of the chain's native asset.
     */
    enableAutoDraw: (
        account: WalletAccount,
        cardAddress: string,
    ) => Promise<void>
    /** Turns auto-funding OFF on chain. */
    disableAutoDraw: (account: WalletAccount) => Promise<void>
    /** Local-key only — Ledger/watch/rekeyed can't sign the delegation. */
    canSwitchToAuto: (account: WalletAccount) => boolean
    isPending: boolean
}

/**
 * The post-onboarding funding-type switch. The chain's card adapter owns the
 * delegation and the on-chain switch; this hook adds the pending state the
 * sheet renders.
 */
export const useAutoDrawSwitch = (): UseAutoDrawSwitchResult => {
    const scope = useCardScope()
    const autoDraw = useCardAutoDraw(scope)
    const [isPending, setIsPending] = useState(false)

    const canSwitchToAuto = useCallback(
        (account: WalletAccount) => canAutoFund(account, scope),
        [scope],
    )

    const enableAutoDraw = useCallback(
        async (account: WalletAccount, cardAddress: string): Promise<void> => {
            setIsPending(true)
            try {
                await autoDraw.enableAutoDraw(account, cardAddress)
            } finally {
                setIsPending(false)
            }
        },
        [autoDraw],
    )

    const disableAutoDraw = useCallback(
        async (account: WalletAccount): Promise<void> => {
            setIsPending(true)
            try {
                await autoDraw.disableAutoDraw(account)
            } finally {
                setIsPending(false)
            }
        },
        [autoDraw],
    )

    return { enableAutoDraw, disableAutoDraw, canSwitchToAuto, isPending }
}

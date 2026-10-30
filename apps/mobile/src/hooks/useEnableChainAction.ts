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

import { useCallback, useRef, useState } from 'react'
import {
    useEnableChain,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { bottomSheetNotifier } from '@components/core'
import { useErrorToast } from '@hooks/useErrorToast'
import { useIsMounted } from '@hooks/useIsMounted'

export type UseEnableChainActionResult = {
    /** The chain being enabled while its address is derived; unset otherwise. */
    enablingChainId: Optional<ChainId>
    /** Enables one chain at a time; `onEnabled` gets the account once it holds the chain. */
    enableChain: (
        accountId: string,
        chainId: ChainId,
        onEnabled?: (account: WalletAccount) => void,
    ) => void
    /** Enables the chain on each account in turn, stopping at the first failure; `onEnabled` runs once, after all hold it. */
    enableChainOnAccounts: (
        accountIds: readonly string[],
        chainId: ChainId,
        onEnabled?: () => void,
    ) => void
}

/** Adds a chain to an account from a sheet the user stays on, reporting a failure with `errorTitle`. */
export const useEnableChainAction = (
    errorTitle: string,
): UseEnableChainActionResult => {
    const enable = useEnableChain()
    const { showError } = useErrorToast()
    const isMounted = useIsMounted()
    const [enablingChainId, setEnablingChainId] = useState<Optional<ChainId>>()
    // State lags a second tap that lands before the re-render.
    const isEnablingRef = useRef(false)

    const run = useCallback(
        (chainId: ChainId, task: () => Promise<void>) => {
            if (isEnablingRef.current) return
            isEnablingRef.current = true
            setEnablingChainId(chainId)
            void (async () => {
                try {
                    // Derivation blocks the JS thread; let the loading state paint first.
                    await new Promise(resolve => requestAnimationFrame(resolve))
                    await task()
                } catch (error) {
                    if (!isMounted()) return
                    showError(error, errorTitle, {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    })
                } finally {
                    isEnablingRef.current = false
                    if (isMounted()) setEnablingChainId(undefined)
                }
            })()
        },
        [isMounted, showError, errorTitle],
    )

    const enableChain = useCallback(
        (
            accountId: string,
            chainId: ChainId,
            onEnabled?: (account: WalletAccount) => void,
        ) =>
            run(chainId, async () => {
                const account = await enable(accountId, chainId, 'user')
                if (isMounted()) onEnabled?.(account)
            }),
        [run, enable, isMounted],
    )

    const enableChainOnAccounts = useCallback(
        (
            accountIds: readonly string[],
            chainId: ChainId,
            onEnabled?: () => void,
        ) =>
            run(chainId, async () => {
                for (const accountId of accountIds) {
                    await enable(accountId, chainId, 'user')
                }
                if (isMounted()) onEnabled?.()
            }),
        [run, enable, isMounted],
    )

    return { enablingChainId, enableChain, enableChainOnAccounts }
}

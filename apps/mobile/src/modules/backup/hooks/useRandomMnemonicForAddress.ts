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

import { useEffect, useState } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    mnemonicIndexToWord,
    pickDistinctIndexes,
    type MnemonicWordAtPosition,
} from '@perawallet/wallet-core-kms'
import {
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useMnemonicForAddress } from './useMnemonicForAddress'

export type UseRandomMnemonicForAddressResult = {
    picks: MnemonicWordAtPosition[] | null
    error: Error | null
    isLoading: boolean
}

// Surfaces N {index, word} pairs for the verification quiz. The full mnemonic
// is resolved inside `executeWithMnemonic`, picked from there, and the raw
// bytes are zeroed before this hook's state is populated — only the sampled
// pairs survive.
export const useRandomMnemonicForAddress = (
    address: Optional<string>,
    account: Nullable<WalletAccount>,
    count: number,
): UseRandomMnemonicForAddressResult => {
    const { executeWithMnemonic } = useMnemonicForAddress(address, account)

    const [state, setState] = useState<UseRandomMnemonicForAddressResult>({
        picks: null,
        error: null,
        isLoading: true,
    })

    useEffect(() => {
        if (!address || !account || account.address !== address) {
            setState({
                picks: null,
                error: new Error('Account not found'),
                isLoading: false,
            })
            return
        }

        let cancelled = false
        setState({ picks: null, error: null, isLoading: true })

        executeWithMnemonic(indices => {
            // Pick the positions first, then resolve a word for only those
            // positions — the rest of the phrase never leaves the index buffer.
            const positions = pickDistinctIndexes(count, indices.length).sort(
                (a, b) => a - b,
            )
            return positions.map(position => ({
                index: position,
                word: mnemonicIndexToWord(indices[position]),
            }))
        })
            .then(picks => {
                if (!cancelled) {
                    setState({ picks, error: null, isLoading: false })
                }
            })
            .catch(err => {
                logger.error(
                    'BackupVerification: failed to sample mnemonic words',
                    {
                        accountType: account.type,
                        error: err instanceof Error ? err.message : String(err),
                        stack: err instanceof Error ? err.stack : undefined,
                    },
                )
                if (!cancelled) {
                    setState({
                        picks: null,
                        error: err as Error,
                        isLoading: false,
                    })
                }
            })

        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, count])

    return state
}

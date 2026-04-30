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

import { useCallback, useEffect, useState } from 'react'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { useMnemonicForAddress } from '@modules/backup'

export type UseViewPassphraseBottomSheetParams = {
    address: string
    isVisible: boolean
}

export type UseViewPassphraseBottomSheetResult = {
    words: string[]
    isLoading: boolean
    error: Error | null
}

export const useViewPassphraseBottomSheet = ({
    address,
    isVisible,
}: UseViewPassphraseBottomSheetParams): UseViewPassphraseBottomSheetResult => {
    const account = useAccountsStore(
        state => state.accounts.find(a => a.address === address) ?? null,
    )
    const { executeWithMnemonic } = useMnemonicForAddress(address, account)
    const [words, setWords] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Overwrite each slot in the existing array before dereferencing so the
    // previously decoded phrase doesn't linger in memory waiting on GC.
    const clearWords = useCallback(() => {
        setWords(previous => {
            previous.fill('')
            return []
        })
    }, [])

    useEffect(() => {
        if (!isVisible) {
            clearWords()
            setError(null)
            setIsLoading(false)
            return
        }
        let cancelled = false
        setIsLoading(true)
        setError(null)
        executeWithMnemonic((resolvedWords: string[]) => {
            if (!cancelled) setWords(resolvedWords)
        })
            .catch(err => {
                logger.error('ViewPassphrase: failed to retrieve mnemonic', {
                    error: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                })
                clearWords()
                if (!cancelled) setError(err as Error)
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })
        return () => {
            cancelled = true
            clearWords()
        }
    }, [isVisible, executeWithMnemonic, clearWords])

    return { words, isLoading, error }
}

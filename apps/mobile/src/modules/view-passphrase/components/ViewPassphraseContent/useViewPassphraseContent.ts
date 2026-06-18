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
import { indicesToMnemonicWords } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { useMnemonicForAddress } from '@modules/backup'

export type UseViewPassphraseContentParams = {
    address: string
}

export type UseViewPassphraseContentResult = {
    words: string[]
    isLoading: boolean
    error: Error | null
}

export const useViewPassphraseContent = ({
    address,
}: UseViewPassphraseContentParams): UseViewPassphraseContentResult => {
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
        let cancelled = false
        setIsLoading(true)
        setError(null)
        executeWithMnemonic(indices => {
            if (!cancelled) setWords(indicesToMnemonicWords(indices))
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
    }, [executeWithMnemonic, clearWords])

    return { words, isLoading, error }
}

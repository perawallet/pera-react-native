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
import { mnemonicIndexToWord, zeroBytes } from '@perawallet/wallet-core-kms'
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
    const [indices, setIndices] = useState<Uint16Array | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Zero the retained index buffer before dropping it so the phrase doesn't
    // linger in memory waiting on GC.
    const clearIndices = useCallback(() => {
        setIndices(previous => {
            zeroBytes(previous)
            return null
        })
    }, [])

    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        setError(null)
        executeWithMnemonic(src => {
            // Retain a zeroable copy; words are derived at render, never stored.
            if (!cancelled) setIndices(src.slice())
        })
            .catch(err => {
                logger.error('ViewPassphrase: failed to retrieve mnemonic', {
                    error: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                })
                clearIndices()
                if (!cancelled) setError(err as Error)
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })
        return () => {
            cancelled = true
            clearIndices()
        }
    }, [executeWithMnemonic, clearIndices])

    // Derived at render only — the full word array is never held in state.
    const words = indices ? Array.from(indices, mnemonicIndexToWord) : []

    return { words, isLoading, error }
}

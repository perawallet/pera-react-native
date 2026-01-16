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

import { useState, useCallback } from 'react'

/**
 * A hook for managing asynchronous actions with loading and error states.
 *
 * @param action - The asynchronous function to execute
 * @returns State and methods for managing the async action
 *
 * @example
 * const { execute, isProcessing, error } = useAsyncAction(fetchData)
 * execute(params)
 */
export function useAsyncAction<TArgs extends unknown[], TReturn>(
    action: (...args: TArgs) => Promise<TReturn>,
) {
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const execute = useCallback(
        async (...args: TArgs): Promise<TReturn> => {
            setIsProcessing(true)
            setError(null)
            try {
                const result = await action(...args)
                setIsProcessing(false)
                return result
            } catch (err) {
                const error =
                    err instanceof Error ? err : new Error(String(err))
                setError(error)
                setIsProcessing(false)
                throw error
            }
        },
        [action],
    )

    const reset = useCallback(() => {
        setIsProcessing(false)
        setError(null)
    }, [])

    return {
        isProcessing,
        execute,
        error,
        reset,
    }
}

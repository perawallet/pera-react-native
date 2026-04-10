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

import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { useNfdSearchQuery } from '@perawallet/wallet-core-nfd'
import { useDebouncedValue } from '@hooks/useDebouncedValue'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'

type UseNfdResolveResult = {
    /** Direct address if input is a valid Algorand address, otherwise the NFD-resolved address (or empty string). */
    resolvedAddress: string
    /** Whether the input is itself a valid Algorand address. */
    isDirectAddress: boolean
    /** Whether the input was successfully resolved via an NFD lookup. */
    isNfdResolved: boolean
    /** Whether an NFD lookup is currently in flight. */
    isNfdResolving: boolean
    /** The matching NFD name, if one was resolved. */
    nfdName: string | undefined
}

export const useNfdResolve = (
    input: string,
    options?: { enabled?: boolean },
): UseNfdResolveResult => {
    const enabled = options?.enabled ?? true
    const debouncedInput = useDebouncedValue(input, SEARCH_DEBOUNCE_TIME)
    const isDirectAddress = isValidAlgorandAddress(input)
    const shouldSearchNfd =
        enabled && debouncedInput.includes('.') && !isDirectAddress

    const { data: nfdResults, isLoading: isNfdResolving } = useNfdSearchQuery(
        debouncedInput,
        { enabled: shouldSearchNfd },
    )

    const nfdMatch = nfdResults?.at(0)
    const isNfdResolved = !isDirectAddress && !!nfdMatch
    const resolvedAddress = isDirectAddress ? input : (nfdMatch?.address ?? '')

    return {
        resolvedAddress,
        isDirectAddress,
        isNfdResolved,
        isNfdResolving,
        nfdName: nfdMatch?.name,
    }
}

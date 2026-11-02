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

export type UseSearchInputProps = {
    value?: string
    onChangeText?: (text: string) => void
}

export type UseSearchInputResult = {
    currentValue: string
    hasValue: boolean
    handleChangeText: (text: string) => void
    handleClear: () => void
}

export const useSearchInput = ({
    value,
    onChangeText,
}: UseSearchInputProps): UseSearchInputResult => {
    const [internalValue, setInternalValue] = useState('')
    const currentValue = value ?? internalValue
    const hasValue = !!currentValue && String(currentValue).length > 0

    const handleChangeText = useCallback(
        (text: string) => {
            setInternalValue(text)
            onChangeText?.(text)
        },
        [onChangeText],
    )

    const handleClear = useCallback(() => {
        setInternalValue('')
        onChangeText?.('')
    }, [onChangeText])

    return { currentValue, hasValue, handleChangeText, handleClear }
}

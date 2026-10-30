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

export type UsePassphraseWordInputProps = {
    index: number
    onChangeWord: (value: string, index: number) => void
    onFocusWord: (index: number) => void
    onSubmitWord: (index: number) => void
}

export type UsePassphraseWordInputResult = {
    handleChangeText: (text: string) => void
    handleFocus: () => void
    handleSubmitEditing: () => void
}

export const usePassphraseWordInput = ({
    index,
    onChangeWord,
    onFocusWord,
    onSubmitWord,
}: UsePassphraseWordInputProps): UsePassphraseWordInputResult => {
    const handleChangeText = useCallback(
        (text: string) => onChangeWord(text, index),
        [onChangeWord, index],
    )
    const handleFocus = useCallback(
        () => onFocusWord(index),
        [onFocusWord, index],
    )
    const handleSubmitEditing = useCallback(
        () => onSubmitWord(index),
        [onSubmitWord, index],
    )

    return { handleChangeText, handleFocus, handleSubmitEditing }
}

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

import { useCallback, useMemo, useState } from 'react'

const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

export type UseBackupVerificationResult = {
    orderedSlots: (string | null)[]
    poolWords: string[]
    onTapPoolWord: (word: string, poolIdx: number) => void
    onTapSlot: (slotIdx: number) => void
    onFinish: () => void
    onStartOver: () => void
    isFilled: boolean
    validationError: boolean
}

export const useBackupVerification = (
    correctWords: string[],
    onSuccess: () => void,
): UseBackupVerificationResult => {
    const [orderedSlots, setOrderedSlots] = useState<(string | null)[]>(() =>
        Array(correctWords.length).fill(null),
    )
    const [poolWords, setPoolWords] = useState<string[]>(() =>
        shuffle(correctWords),
    )
    const [validationError, setValidationError] = useState(false)

    const clearError = useCallback(() => {
        setValidationError(prev => (prev ? false : prev))
    }, [])

    const onTapPoolWord = useCallback(
        (word: string, poolIdx: number) => {
            clearError()
            const firstEmpty = orderedSlots.findIndex(s => s === null)
            if (firstEmpty === -1) return
            const nextSlots = [...orderedSlots]
            nextSlots[firstEmpty] = word
            const nextPool = poolWords.filter((_, i) => i !== poolIdx)
            setOrderedSlots(nextSlots)
            setPoolWords(nextPool)
        },
        [orderedSlots, poolWords, clearError],
    )

    const onTapSlot = useCallback(
        (slotIdx: number) => {
            clearError()
            const word = orderedSlots[slotIdx]
            if (word === null) return
            const nextSlots = [...orderedSlots]
            nextSlots[slotIdx] = null
            setOrderedSlots(nextSlots)
            setPoolWords([...poolWords, word])
        },
        [orderedSlots, poolWords, clearError],
    )

    const onStartOver = useCallback(() => {
        setOrderedSlots(Array(correctWords.length).fill(null))
        setPoolWords(shuffle(correctWords))
        setValidationError(false)
    }, [correctWords])

    const isFilled = useMemo(
        () => orderedSlots.every(s => s !== null),
        [orderedSlots],
    )

    const onFinish = useCallback(() => {
        if (!isFilled) return
        const matches = orderedSlots.every(
            (word, i) => word === correctWords[i],
        )
        if (matches) {
            onSuccess()
        } else {
            setValidationError(true)
        }
    }, [isFilled, orderedSlots, correctWords, onSuccess])

    return {
        orderedSlots,
        poolWords,
        onTapPoolWord,
        onTapSlot,
        onFinish,
        onStartOver,
        isFilled,
        validationError,
    }
}

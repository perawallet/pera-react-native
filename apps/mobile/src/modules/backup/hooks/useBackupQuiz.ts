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
import {
    type MnemonicWordAtPosition,
    uniformIntBelow,
} from '@perawallet/wallet-core-kms'

const OPTIONS_PER_QUESTION = 3

const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = uniformIntBelow(i + 1)
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

export type BackupQuizItem = {
    position: number
    correctWord: string
    options: string[]
    selectedWord: string | null
}

export type UseBackupQuizResult = {
    items: BackupQuizItem[]
    onSelect: (questionIdx: number, word: string) => void
    onSubmit: () => void
    isFilled: boolean
    hasError: boolean
}

const buildQuestions = (
    correctPairs: MnemonicWordAtPosition[],
    distractorPool: string[],
): BackupQuizItem[] => {
    const correctSet = new Set(correctPairs.map(p => p.word))
    const pool = distractorPool.filter(w => !correctSet.has(w))
    const distractorsPerQuestion = OPTIONS_PER_QUESTION - 1
    // Shuffle the pool once and draw a distinct slice per question. Always
    // shuffling (even when the pool ends up smaller than total needed) keeps
    // distractors from appearing in the wordlist order — otherwise the user
    // could spot the correct word as the one that's in sequence.
    const stream = shuffle(pool)

    return correctPairs.map(({ index, word }, questionIdx) => {
        const distractors = stream.slice(
            questionIdx * distractorsPerQuestion,
            (questionIdx + 1) * distractorsPerQuestion,
        )
        const options = shuffle([word, ...distractors])
        return {
            position: index,
            correctWord: word,
            options,
            selectedWord: null,
        }
    })
}

export const useBackupQuiz = (
    correctPairs: MnemonicWordAtPosition[],
    distractorPool: string[],
    onSuccess: () => void,
    onWrong?: () => void,
): UseBackupQuizResult => {
    const [items, setItems] = useState<BackupQuizItem[]>(() =>
        buildQuestions(correctPairs, distractorPool),
    )
    const [hasError, setHasError] = useState(false)

    const onSelect = useCallback((questionIdx: number, word: string) => {
        setHasError(false)
        setItems(prev =>
            prev.map((item, i) =>
                i === questionIdx ? { ...item, selectedWord: word } : item,
            ),
        )
    }, [])

    const isFilled = useMemo(
        () =>
            items.length > 0 && items.every(item => item.selectedWord !== null),
        [items],
    )

    const onSubmit = useCallback(() => {
        if (!isFilled) return
        const allCorrect = items.every(
            item => item.selectedWord === item.correctWord,
        )
        if (allCorrect) {
            onSuccess()
            return
        }
        setHasError(true)
        setItems(buildQuestions(correctPairs, distractorPool))
        if (onWrong) onWrong()
    }, [isFilled, items, correctPairs, distractorPool, onSuccess, onWrong])

    return { items, onSelect, onSubmit, isFilled, hasError }
}

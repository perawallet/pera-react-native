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

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    type PropsWithChildren,
} from 'react'

type BackupFlowContextValue = {
    getWords: () => string[] | null
    setWords: (words: string[]) => void
    clearWords: () => void
}

const BackupFlowContext = createContext<BackupFlowContextValue | null>(null)

// Overwrite each slot before dropping the array so any existing string
// references inside it are released immediately rather than waiting for GC.
const purge = (arr: string[] | null): void => {
    if (!arr) return
    for (let i = 0; i < arr.length; i++) arr[i] = ''
    arr.length = 0
}

export const BackupFlowProvider = ({ children }: PropsWithChildren) => {
    const wordsRef = useRef<string[] | null>(null)

    const value = useMemo<BackupFlowContextValue>(
        () => ({
            getWords: () => wordsRef.current,
            setWords: (words: string[]) => {
                purge(wordsRef.current)
                wordsRef.current = [...words]
            },
            clearWords: () => {
                purge(wordsRef.current)
                wordsRef.current = null
            },
        }),
        [],
    )

    // Guarantee the in-flight mnemonic is purged whenever the backup stack
    // unmounts, regardless of whether the user completed or abandoned the flow.
    useEffect(
        () => () => {
            purge(wordsRef.current)
            wordsRef.current = null
        },
        [],
    )

    return (
        <BackupFlowContext.Provider value={value}>
            {children}
        </BackupFlowContext.Provider>
    )
}

export const useBackupFlowWords = (): BackupFlowContextValue => {
    const ctx = useContext(BackupFlowContext)
    if (ctx === null) {
        throw new Error(
            'useBackupFlowWords must be used within a BackupFlowProvider',
        )
    }
    return ctx
}

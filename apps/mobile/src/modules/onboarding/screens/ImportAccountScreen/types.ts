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

import type { PWInputRef } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseImportAccountScreenResult = {
    words: string[]
    focused: number
    setFocused: (index: number) => void
    canImport: boolean
    invalidWordIndices: Set<number>
    processing: boolean
    updateWord: (word: string, index: number) => void
    handleWordChange: (word: string, index: number) => void
    handleImportAccount: () => void
    mnemonicLength: number
    titleKey: string
    infoNoteKey: string | null
    t: (key: string) => string
    handleOpenSupportOptions: () => void
    isQRScannerVisible: boolean
    handleCloseQRScanner: () => void
    handleQRScannerSuccess: (url: string) => void
    suggestions: string[]
    handleSelectSuggestion: (word: string) => void
    refCallbacks: ((ref: Nullable<PWInputRef>) => void)[]
    handleSubmitEditing: (index: number) => void
}

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

import { useCallback, useMemo, useState } from 'react'
import { useClipboard } from '@hooks/useClipboard'

export type UseViewTextDetailsContentProps = {
    text: string
}

export type ViewTextDetailsMode = 'text' | 'hex' | 'base64'

export type UseViewTextDetailsContentResult = {
    mode: ViewTextDetailsMode
    textToDisplay: string
    copyText: () => void
    handleSelectText: () => void
    handleSelectHex: () => void
    handleSelectBase64: () => void
}

export const useViewTextDetailsContent = ({
    text,
}: UseViewTextDetailsContentProps): UseViewTextDetailsContentResult => {
    const { copyToClipboard } = useClipboard()

    const [mode, setMode] = useState<ViewTextDetailsMode>('text')

    const textToDisplay = useMemo(() => {
        switch (mode) {
            case 'text': {
                return text
            }
            case 'hex': {
                return Buffer.from(text).toString('hex')
            }
            case 'base64': {
                return Buffer.from(text).toString('base64')
            }
        }
    }, [text, mode])

    const copyText = useCallback(() => {
        void copyToClipboard(textToDisplay)
    }, [copyToClipboard, textToDisplay])

    const handleSelectText = useCallback(() => setMode('text'), [])
    const handleSelectHex = useCallback(() => setMode('hex'), [])
    const handleSelectBase64 = useCallback(() => setMode('base64'), [])

    return {
        mode,
        textToDisplay,
        copyText,
        handleSelectText,
        handleSelectHex,
        handleSelectBase64,
    }
}

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

import { useMemo } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

export type PassphraseGridProps = {
    /**
     * Wordlist indices, not words: each word is resolved at render so the full
     * phrase is never held as a `string[]`. See `mnemonicIndexToWord`.
     */
    wordIndices: Uint16Array | null
    style?: StyleProp<ViewStyle>
}

export const PassphraseGrid = ({ wordIndices, style }: PassphraseGridProps) => {
    const styles = useStyles()
    const indices = useMemo(() => Array.from(wordIndices ?? []), [wordIndices])

    return (
        <PWView style={[styles.grid, style]}>
            {indices.map((wordIndex, position) => (
                <PWView
                    key={`${position}-${wordIndex}`}
                    style={styles.wordCell}
                >
                    <PWText style={styles.wordIndex}>
                        {String(position + 1)}
                    </PWText>
                    <PWText style={styles.wordText}>
                        {mnemonicIndexToWord(wordIndex)}
                    </PWText>
                </PWView>
            ))}
        </PWView>
    )
}

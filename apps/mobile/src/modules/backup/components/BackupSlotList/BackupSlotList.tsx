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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type BackupSlotListProps = {
    slots: (string | null)[]
    onTapSlot: (slotIdx: number) => void
    hasError?: boolean
}

export const BackupSlotList = ({
    slots,
    onTapSlot,
    hasError = false,
}: BackupSlotListProps) => {
    const styles = useStyles({ hasError })
    return (
        <PWView style={styles.container}>
            {slots.map((word, i) => (
                <PWView key={i} style={styles.slotRow}>
                    <PWText style={styles.index}>{String(i + 1)}</PWText>
                    {word !== null ? (
                        <PWTouchableOpacity onPress={() => onTapSlot(i)}>
                            <PWText style={styles.word}>{word}</PWText>
                        </PWTouchableOpacity>
                    ) : (
                        <PWView style={styles.emptySlot} />
                    )}
                </PWView>
            ))}
        </PWView>
    )
}

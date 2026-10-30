/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import React from 'react'
import { PWView } from '@components/core'
import { ConfettiPiece } from '../ConfettiPiece'
import { useStyles } from './styles'
import { useConfettiField, type ConfettiFieldProps } from './useConfettiField'

export type { ConfettiFieldProps }

export const ConfettiField = ({ onFinish }: ConfettiFieldProps) => {
    const styles = useStyles()
    const { pieces } = useConfettiField({ onFinish })

    return (
        <PWView
            style={styles.container}
            testID='confetti_animation'
        >
            {pieces.map(piece => (
                <ConfettiPiece
                    key={piece.id}
                    config={piece}
                />
            ))}
        </PWView>
    )
}

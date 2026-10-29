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

import React, { useEffect, useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { PWView } from '@components/core'
import { ConfettiPiece } from '../ConfettiPiece'
import { createConfettiPieces } from '../createConfettiPieces'
import { useConfettiColors } from '../styles'
import { useStyles } from './styles'

const PIECE_COUNT = 80

export type ConfettiFieldProps = {
    onFinish: () => void
}

export const ConfettiField = ({ onFinish }: ConfettiFieldProps) => {
    const styles = useStyles()
    const colors = useConfettiColors()
    const { width, height } = useWindowDimensions()

    const pieces = useMemo(
        () => createConfettiPieces(PIECE_COUNT, { width, height }, colors),
        // Generate once per mount; the field remounts on each play, so a
        // mid-animation dimension change intentionally does not regenerate.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    )

    const totalDurationMs = useMemo(
        () =>
            pieces.reduce(
                (max, piece) => Math.max(max, piece.delayMs + piece.durationMs),
                0,
            ),
        [pieces],
    )

    useEffect(() => {
        const timeout = setTimeout(onFinish, totalDurationMs)
        return () => clearTimeout(timeout)
    }, [onFinish, totalDurationMs])

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

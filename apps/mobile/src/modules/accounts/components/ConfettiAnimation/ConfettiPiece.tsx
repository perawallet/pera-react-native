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

import React, { useEffect } from 'react'
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated'
import type { ConfettiPieceConfig } from './createConfettiPieces'
import { useStyles } from './styles'

const FULL_ROTATION_DEG = 360
const TWO_PI = Math.PI * 2
// Depth for the 3D tumble — smaller = stronger foreshortening.
const PERSPECTIVE = 600

type ConfettiPieceProps = {
    config: ConfettiPieceConfig
}

export const ConfettiPiece = ({ config }: ConfettiPieceProps) => {
    const styles = useStyles()
    const progress = useSharedValue(0)

    useEffect(() => {
        // Linear driver; all easing/shaping happens in the worklet below.
        progress.value = withDelay(
            config.delayMs,
            withTiming(1, {
                duration: config.durationMs,
                easing: Easing.linear,
            }),
        )
    }, [config.delayMs, config.durationMs, progress])

    // Runs on the UI thread, so a busy JS thread never stalls the flight.
    const animatedStyle = useAnimatedStyle(() => {
        const p = progress.value
        const lf = config.launchFraction

        let x: number
        let y: number

        if (p < lf) {
            // Launch: explosive burst, fast then decelerating (easeOutCubic).
            // Quadratic Bézier through the control point so the flake leaves
            // the muzzle at 45° up-and-inward before arcing to the apex.
            const t = p / lf
            const eased = 1 - Math.pow(1 - t, 3)
            const inv = 1 - eased
            const a = inv * inv
            const b = 2 * inv * eased
            const c = eased * eased
            x =
                a * config.originX +
                b * config.launchControlX +
                c * config.burstX
            y =
                a * config.originY +
                b * config.launchControlY +
                c * config.burstY
        } else {
            // Drop: gentle gravity-style fall (easeInQuad) while drifting
            // out to an even horizontal spread (easeOutQuad).
            const t = (p - lf) / (1 - lf)
            const fall = t * t
            const drift = 1 - Math.pow(1 - t, 2)
            x = config.burstX + (config.fallX - config.burstX) * drift
            y = config.burstY + (config.fallTargetY - config.burstY) * fall
        }

        const sway =
            Math.sin(p * config.swayFrequency * TWO_PI) * config.swayAmplitude

        // Hidden while parked at the muzzle (progress held at 0 during the
        // stagger delay); snaps visible the instant the launch begins, still
        // off-screen.
        const launchGate = interpolate(
            p,
            [0, 0.01],
            [0, 1],
            Extrapolation.CLAMP,
        )
        // Fades out by screen position (not time) so flakes vanish partway
        // down rather than riding to the floor.
        const cullGate = interpolate(
            y,
            [config.cullStartY, config.cullEndY],
            [1, 0],
            Extrapolation.CLAMP,
        )
        const opacity = launchGate * cullGate

        return {
            opacity,
            transform: [
                { perspective: PERSPECTIVE },
                { translateX: x + sway },
                { translateY: y },
                {
                    rotateX: `${config.initialX + p * config.spinX * FULL_ROTATION_DEG}deg`,
                },
                {
                    rotateY: `${config.initialY + p * config.spinY * FULL_ROTATION_DEG}deg`,
                },
                {
                    rotateZ: `${config.initialZ + p * config.spinZ * FULL_ROTATION_DEG}deg`,
                },
            ],
        }
    })

    return (
        <Animated.View
            style={[
                styles.piece,
                // Per-flake size/color/shape are data, not design tokens, so they
                // are applied dynamically rather than living in makeStyles.
                {
                    width: config.width,
                    height: config.height,
                    borderRadius: config.borderRadius,
                    backgroundColor: config.color,
                },
                animatedStyle,
            ]}
        />
    )
}

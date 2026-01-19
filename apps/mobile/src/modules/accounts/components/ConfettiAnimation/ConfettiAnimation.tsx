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

import React, { useEffect, useState } from 'react'
import LottieView from 'lottie-react-native'
import confettiAnimation from '@assets/animations/confetti.json'
import { useStyles } from './styles'

export type ConfettiAnimationProps = {
    play: boolean
    onFinish?: () => void
}

export const ConfettiAnimation = ({ play, onFinish }: ConfettiAnimationProps) => {
    const styles = useStyles()
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (play) {
            // Delay confetti slightly to ensure it plays after the page is fully rendered
            const timeout = setTimeout(() => {
                setVisible(true)
            }, 500)

            return () => clearTimeout(timeout)
        }

        setVisible(false)
        return undefined
    }, [play])

    const handleAnimationFinish = () => {
        setVisible(false)
        onFinish?.()
    }

    if (!visible) {
        return null
    }

    return (
        <LottieView
            autoPlay={true}
            loop={false}
            onAnimationFinish={handleAnimationFinish}
            source={confettiAnimation}
            style={styles.container}
        />
    )
}

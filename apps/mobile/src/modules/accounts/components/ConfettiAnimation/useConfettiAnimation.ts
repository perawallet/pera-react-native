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

import { useCallback, useEffect, useState } from 'react'

export type ConfettiAnimationProps = {
    play: boolean
    onFinish?: () => void
}

// Delay confetti slightly to ensure it plays after the page is fully rendered.
const RENDER_DELAY_MS = 500

export type UseConfettiAnimationResult = {
    isVisible: boolean
    handleFinish: () => void
}

export const useConfettiAnimation = ({
    play,
    onFinish,
}: ConfettiAnimationProps): UseConfettiAnimationResult => {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (play) {
            const timeout = setTimeout(
                () => setIsVisible(true),
                RENDER_DELAY_MS,
            )
            return () => clearTimeout(timeout)
        }

        setIsVisible(false)
        return undefined
    }, [play])

    const handleFinish = useCallback(() => {
        setIsVisible(false)
        onFinish?.()
    }, [onFinish])

    return {isVisible, handleFinish}
}

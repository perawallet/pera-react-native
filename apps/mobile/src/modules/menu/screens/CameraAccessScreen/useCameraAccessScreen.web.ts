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
import { closeCurrentTab } from '@perawallet/wallet-core-browser-runtime'
import { logger } from '@perawallet/wallet-core-shared'

export type CameraAccessState = 'requesting' | 'granted' | 'denied'

export type UseCameraAccessScreenResult = {
    state: CameraAccessState
    handleClose: () => void
}

// Camera permission is per extension origin, so granting it in this tab lets
// the popup's scanners start the camera inline without ever prompting there.
export const useCameraAccessScreen = (): UseCameraAccessScreenResult => {
    const [state, setState] = useState<CameraAccessState>('requesting')

    useEffect(() => {
        let isCancelled = false

        const request = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                })
                stream.getTracks().forEach(track => track.stop())
                if (!isCancelled) setState('granted')
            } catch (error) {
                logger.debug('CameraAccessScreen: getUserMedia() failed', {
                    error,
                })
                if (!isCancelled) setState('denied')
            }
        }

        void request()

        return () => {
            isCancelled = true
        }
    }, [])

    const handleClose = useCallback(() => {
        void closeCurrentTab()
    }, [])

    return { state, handleClose }
}

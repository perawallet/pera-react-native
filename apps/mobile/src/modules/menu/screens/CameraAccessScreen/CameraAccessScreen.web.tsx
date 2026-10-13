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

import React from 'react'
import { LoadingView } from '@components/LoadingView'
import { ScreenHeader } from '@components/ScreenHeader'
import { PWButton, PWScreen, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useCameraAccessScreen,
    type CameraAccessState,
} from './useCameraAccessScreen.web'
import { useStyles } from './styles'

const DESCRIPTION_KEYS: Record<CameraAccessState, string> = {
    requesting: 'qr_scanner.camera_access_requesting',
    granted: 'qr_scanner.camera_access_granted',
    denied: 'qr_scanner.camera_access_denied',
}

export const CameraAccessScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { state, handleClose } = useCameraAccessScreen()

    return (
        <PWScreen testID='camera_access_screen'>
            <PWView style={styles.container}>
                <ScreenHeader
                    title={t('qr_scanner.camera_access_title')}
                    description={t(DESCRIPTION_KEYS[state])}
                />
                {state === 'requesting' ? (
                    <LoadingView variant='circle' />
                ) : (
                    <PWButton
                        variant='primary'
                        title={t('qr_scanner.camera_access_close')}
                        onPress={handleClose}
                        testID='camera_access_close_button'
                    />
                )}
            </PWView>
        </PWScreen>
    )
}

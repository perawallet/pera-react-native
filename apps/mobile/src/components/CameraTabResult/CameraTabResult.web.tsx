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
import { PWResultView } from '@components/core'
import { useCameraTabResult } from './useCameraTabResult.web'

export const CameraTabResult = (): React.JSX.Element | null => {
    const { title, body, closeLabel, handleClose } = useCameraTabResult()

    if (!title) return null

    return (
        <PWResultView
            variant='success'
            title={title}
            body={body}
            primaryAction={{ label: closeLabel, onPress: handleClose }}
            testID='camera-tab-result'
        />
    )
}

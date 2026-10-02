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

import { useCallback } from 'react'
import {
    getConsumedExpandedFlow,
    type ExpandedFlow,
} from '@perawallet/wallet-core-browser-runtime'
import {
    useCameraTabResultStore,
    type CameraTabResultKind,
} from '@components/CameraTabResult'
import type {
    CameraTabOutcome,
    UseFinishCameraTabResult,
} from './useFinishCameraTab'

// A camera tab exists for one action, so the tab's flow, not the exit that
// fired, decides the message. Once that action is done the tab must not stay
// on as a second wallet UI next to the popup.
const RESULT_BY_FLOW: Partial<Record<ExpandedFlow, CameraTabResultKind>> = {
    scan: 'account-imported',
    'backup-restore-scan': 'backup-restored',
}

export const useFinishCameraTab = (): UseFinishCameraTabResult => {
    const showResult = useCameraTabResultStore(state => state.showResult)

    const finishCameraTab = useCallback(
        (outcome: CameraTabOutcome = 'succeeded') => {
            const flow = getConsumedExpandedFlow()
            const result = flow ? RESULT_BY_FLOW[flow] : undefined
            if (!result) return
            showResult(outcome === 'failed' ? 'import-failed' : result)
        },
        [showResult],
    )

    return { finishCameraTab }
}

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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCameraTabResultStore } from '@components/CameraTabResult/useCameraTabResultStore'
import { useFinishCameraTab } from '../useFinishCameraTab.web'

const { consumedFlow } = vi.hoisted(() => ({
    consumedFlow: { current: null as string | null },
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    getConsumedExpandedFlow: () => consumedFlow.current,
}))

vi.mock('@components/CameraTabResult', async () => ({
    useCameraTabResultStore: (
        await import('@components/CameraTabResult/useCameraTabResultStore')
    ).useCameraTabResultStore,
}))

describe('useFinishCameraTab (web)', () => {
    beforeEach(() => {
        useCameraTabResultStore.setState({ result: null })
    })

    test.each([
        ['scan', 'account-imported'],
        ['backup-restore-scan', 'backup-restored'],
    ])('in a %s tab, shows the %s result', (flow, expected) => {
        consumedFlow.current = flow
        const { result } = renderHook(() => useFinishCameraTab())

        act(() => result.current.finishCameraTab())

        expect(useCameraTabResultStore.getState().result).toBe(expected)
    })

    test.each([['scan'], ['backup-restore-scan']])(
        'in a %s tab, reports a failed import as one',
        flow => {
            consumedFlow.current = flow
            const { result } = renderHook(() => useFinishCameraTab())

            act(() => result.current.finishCameraTab('failed'))

            expect(useCameraTabResultStore.getState().result).toBe(
                'import-failed',
            )
        },
    )

    test.each([['ledger-usb'], ['camera-access'], [null]])(
        'leaves a %s surface on its normal exit',
        flow => {
            consumedFlow.current = flow
            const { result } = renderHook(() => useFinishCameraTab())

            act(() => result.current.finishCameraTab())

            expect(useCameraTabResultStore.getState().result).toBeNull()
        },
    )
})

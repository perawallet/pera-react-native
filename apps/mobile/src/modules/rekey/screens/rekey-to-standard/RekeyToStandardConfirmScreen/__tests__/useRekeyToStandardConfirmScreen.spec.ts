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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { config } from '@perawallet/wallet-core-config'
import { useRekeyToStandardConfirmScreen } from '../useRekeyToStandardConfirmScreen'

import type {
    RekeyConfirmConfig,
    UseRekeyConfirmScreenResult,
} from '../../../../hooks/useRekeyConfirmScreen'

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useRoute: () => ({
            params: { sourceAddress: 'SRC', targetAddress: 'TGT' },
        }),
    }
})

const mockUseRekeyConfirmScreen =
    vi.fn<(rekeyConfig: RekeyConfirmConfig) => UseRekeyConfirmScreenResult>()
vi.mock('../../../../hooks/useRekeyConfirmScreen', () => ({
    useRekeyConfirmScreen: (rekeyConfig: RekeyConfirmConfig) =>
        mockUseRekeyConfirmScreen(rekeyConfig),
}))

describe('useRekeyToStandardConfirmScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes the routed addresses and the standard support URL and warning copy to the shared confirm hook', () => {
        renderHook(() => useRekeyToStandardConfirmScreen())

        expect(mockUseRekeyConfirmScreen).toHaveBeenCalledWith(
            expect.objectContaining({
                sourceAddress: 'SRC',
                targetAddress: 'TGT',
                supportUrl: config.rekeyToStandardSupportUrl,
                warningCopy: {
                    titleKey: 'rekey.to_standard.confirm.replace_warning.title',
                    bodyKey: 'rekey.to_standard.confirm.replace_warning.body',
                    confirmKey:
                        'rekey.to_standard.confirm.replace_warning.confirm',
                    cancelKey:
                        'rekey.to_standard.confirm.replace_warning.cancel',
                },
                warningTestID: 'rekey-to-standard-previous-rekey-warning-sheet',
            }),
        )
    })

    it('navigates to the standard success screen from onSubmitSuccess', () => {
        renderHook(() => useRekeyToStandardConfirmScreen())

        mockUseRekeyConfirmScreen.mock.calls[0][0].onSubmitSuccess('SRC')

        expect(mockNavigate).toHaveBeenCalledWith('RekeyToStandard', {
            screen: 'RekeyToStandardSuccess',
            params: { sourceAddress: 'SRC' },
        })
    })
})

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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Linking } from 'react-native'
import { useSendEmail } from '../useSendEmail'

const mockErrorToast = vi.fn()

vi.mock('../useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key} ${Object.values(options).join(' ')}` : key,
    }),
}))

describe('useSendEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    })

    it('opens a mailto url with url-encoded subject and body', () => {
        const { result } = renderHook(() => useSendEmail())

        result.current.sendEmail({
            to: 'support@baanx.com',
            subject: 'Report A & B',
            body: 'line one',
        })

        expect(Linking.openURL).toHaveBeenCalledWith(
            'mailto:support@baanx.com?subject=Report%20A%20%26%20B&body=line%20one',
        )
    })

    it('omits the query string when neither subject nor body is given', () => {
        const { result } = renderHook(() => useSendEmail())

        result.current.sendEmail({ to: 'support@baanx.com' })

        expect(Linking.openURL).toHaveBeenCalledWith('mailto:support@baanx.com')
    })

    it('does not toast when the mail composer opens', async () => {
        const { result } = renderHook(() => useSendEmail())

        result.current.sendEmail({ to: 'support@baanx.com', subject: 'hi' })

        await vi.waitFor(() => expect(Linking.openURL).toHaveBeenCalled())
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('shows an error toast (with the address) when no mail client can open it', async () => {
        vi.spyOn(Linking, 'openURL').mockRejectedValue(
            new Error('Unable to open URL'),
        )
        const { result } = renderHook(() => useSendEmail())

        result.current.sendEmail({ to: 'support@baanx.com', subject: 'hi' })

        await vi.waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'common.email_failed.title',
                'common.email_failed.body support@baanx.com',
            ),
        )
    })
})

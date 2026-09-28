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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => {
    const crashReporting = { name: 'crash-reporting' }
    const reporter = vi.fn()
    return {
        crashReporting,
        reporter,
        setErrorReporter: vi.fn(),
        createCrashReportingErrorReporter: vi.fn(() => reporter),
        provider: { crashReporting },
    }
})

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { setErrorReporter: mocks.setErrorReporter },
}))
vi.mock('@perawallet/wallet-extension-platform', () => ({
    createCrashReportingErrorReporter: mocks.createCrashReportingErrorReporter,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => mocks.provider,
}))

import { useCrashReporterBinding } from '../useCrashReporterBinding'

describe('useCrashReporterBinding', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("binds the logger to the provider's crash reporter on mount", () => {
        renderHook(() => useCrashReporterBinding())

        expect(mocks.createCrashReportingErrorReporter).toHaveBeenCalledWith(
            mocks.crashReporting,
        )
        expect(mocks.setErrorReporter).toHaveBeenCalledWith(mocks.reporter)
    })

    it('unbinds the logger on unmount', () => {
        const { unmount } = renderHook(() => useCrashReporterBinding())

        unmount()

        expect(mocks.setErrorReporter).toHaveBeenLastCalledWith(undefined)
    })
})

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

import { describe, expect, it, vi } from 'vitest'

import { onUnhandledRequest, setSuiteUnhandledRequestMode } from '../msw-server'

const reportFor = (url: string) => {
    const warning = vi.fn()
    onUnhandledRequest(new Request(url), { warning })
    return warning
}

describe('onUnhandledRequest', () => {
    it('warns on an unhandled API request by default', () => {
        expect(
            reportFor('https://api.example.test/v1/things'),
        ).toHaveBeenCalledOnce()
    })

    it('stays quiet for static assets, like the built-in warn strategy', () => {
        expect(
            reportFor('https://cdn.example.test/logo.png'),
        ).not.toHaveBeenCalled()
    })

    describe('inside a bypass suite', () => {
        setSuiteUnhandledRequestMode('bypass')

        it('drops the warning', () => {
            expect(
                reportFor('https://api.example.test/v1/things'),
            ).not.toHaveBeenCalled()
        })

        describe('with a nested warn suite', () => {
            setSuiteUnhandledRequestMode('warn')

            it('warns again', () => {
                expect(
                    reportFor('https://api.example.test/v1/things'),
                ).toHaveBeenCalledOnce()
            })
        })

        it('returns to bypass after the nested suite ends', () => {
            expect(
                reportFor('https://api.example.test/v1/things'),
            ).not.toHaveBeenCalled()
        })
    })

    it('returns to warn after the bypass suite ends', () => {
        expect(
            reportFor('https://api.example.test/v1/things'),
        ).toHaveBeenCalledOnce()
    })
})

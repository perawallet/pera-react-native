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

import { afterEach, describe, expect, it, vi } from 'vitest'

const ensureDeviceIDMock = vi.hoisted(() =>
    vi.fn().mockResolvedValue('device-123'),
)
vi.mock('../../device-id', () => ({ ensureDeviceID: ensureDeviceIDMock }))

const configMock = vi.hoisted(() => ({
    config: {
        firebaseMeasurementId: '',
        gaMeasurementApiSecret: '',
    },
}))
vi.mock('@perawallet/wallet-core-config', () => configMock)

const fetchMock = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }))
vi.stubGlobal('fetch', fetchMock)

import { ChromeAnalyticsService } from '../analytics'

describe('ChromeAnalyticsService', () => {
    afterEach(() => {
        vi.clearAllMocks()
        configMock.config.firebaseMeasurementId = ''
        configMock.config.gaMeasurementApiSecret = ''
    })

    it('does not send when measurementId/apiSecret are unset', async () => {
        const service = new ChromeAnalyticsService()
        service.logEvent('test_event', { foo: 'bar' })
        await Promise.resolve()

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('POSTs a GA4 Measurement Protocol event when configured', async () => {
        configMock.config.firebaseMeasurementId = 'G-TEST123'
        configMock.config.gaMeasurementApiSecret = 'test-secret'

        const service = new ChromeAnalyticsService()
        service.logEvent('test_event', { foo: 'bar' })
        await Promise.resolve()
        await Promise.resolve()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toContain('measurement_id=G-TEST123')
        expect(url).toContain('api_secret=test-secret')
        expect(JSON.parse(init.body)).toEqual({
            client_id: 'device-123',
            events: [{ name: 'test_event', params: { foo: 'bar' } }],
        })
    })

    it('never throws when fetch rejects', async () => {
        configMock.config.firebaseMeasurementId = 'G-TEST123'
        configMock.config.gaMeasurementApiSecret = 'test-secret'
        fetchMock.mockRejectedValueOnce(new Error('network down'))

        const service = new ChromeAnalyticsService()
        expect(() => service.logEvent('test_event')).not.toThrow()
    })
})

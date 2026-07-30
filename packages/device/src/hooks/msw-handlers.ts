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

import { http, HttpResponse, type HttpHandler } from 'msw'
import type { DeviceResponse } from '../models'

export type MockRegisterDeviceParams = {
    response: DeviceResponse
    status?: number
}

export const mockRegisterDevice = ({
    response,
    status = 200,
}: MockRegisterDeviceParams): HttpHandler =>
    http.post('*/api/v3/devices', () => HttpResponse.json(response, { status }))

export type MockDeleteDeviceParams = {
    status?: number
}

export const mockDeleteDevice = ({
    status = 204,
}: MockDeleteDeviceParams = {}): HttpHandler =>
    http.delete('*/api/v3/devices', () => new HttpResponse(null, { status }))

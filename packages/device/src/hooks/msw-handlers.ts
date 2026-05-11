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

import { http, HttpResponse, type HttpHandler } from 'msw'
import type { DeviceResponse } from '../models'

export type MockCreateDeviceParams = {
    response: DeviceResponse
    status?: number
}

export const mockCreateDevice = ({
    response,
    status = 200,
}: MockCreateDeviceParams): HttpHandler =>
    http.post('*/v1/devices/', () => HttpResponse.json(response, { status }))

export type MockUpdateDeviceParams = {
    deviceId: string
    response: DeviceResponse
    status?: number
}

export const mockUpdateDevice = ({
    deviceId,
    response,
    status = 200,
}: MockUpdateDeviceParams): HttpHandler =>
    http.patch(`*/v1/devices/${deviceId}/`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockNullifyPushTokenParams = {
    deviceId: string
    status?: number
}

export const mockNullifyPushToken = ({
    deviceId,
    status = 204,
}: MockNullifyPushTokenParams): HttpHandler =>
    http.put(
        `*/v1/devices/${deviceId}/`,
        () => new HttpResponse(null, { status }),
    )

export type MockDeleteDeviceParams = {
    status?: number
}

export const mockDeleteDevice = ({
    status = 204,
}: MockDeleteDeviceParams = {}): HttpHandler =>
    http.delete('*/v1/devices/', () => new HttpResponse(null, { status }))

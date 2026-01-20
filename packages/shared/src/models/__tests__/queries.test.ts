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

import { describe, test, expect } from 'vitest'
import type {
    RequestConfiguration,
    ResponseConfiguration,
    ResponseErrorConfiguration,
} from '../queries'
import { Networks } from '../base-types'

describe('RequestConfiguration', () => {
    test('accepts algod backend configuration', () => {
        const config: RequestConfiguration = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'GET',
        }

        expect(config.backend).toBe('algod')
        expect(config.network).toBe('mainnet')
        expect(config.method).toBe('GET')
    })

    test('accepts indexer backend configuration', () => {
        const config: RequestConfiguration = {
            backend: 'indexer',
            network: Networks.testnet,
            method: 'POST',
        }

        expect(config.backend).toBe('indexer')
        expect(config.network).toBe('testnet')
        expect(config.method).toBe('POST')
    })

    test('accepts pera backend configuration', () => {
        const config: RequestConfiguration = {
            backend: 'pera',
            network: Networks.mainnet,
            method: 'PUT',
        }

        expect(config.backend).toBe('pera')
        expect(config.method).toBe('PUT')
    })

    test('accepts all HTTP methods', () => {
        const methods: Array<RequestConfiguration['method']> = [
            'GET',
            'PUT',
            'PATCH',
            'POST',
            'DELETE',
        ]

        methods.forEach((method) => {
            const config: RequestConfiguration = {
                backend: 'algod',
                network: Networks.mainnet,
                method,
            }

            expect(config.method).toBe(method)
        })
    })

    test('accepts optional url', () => {
        const config: RequestConfiguration = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'GET',
            url: '/v2/accounts',
        }

        expect(config.url).toBe('/v2/accounts')
    })

    test('accepts optional params', () => {
        const config: RequestConfiguration = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'GET',
            params: { limit: 10, offset: 0 },
        }

        expect(config.params).toEqual({ limit: 10, offset: 0 })
    })

    test('accepts optional data', () => {
        const config: RequestConfiguration = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'POST',
            data: { name: 'test', value: 123 },
        }

        expect(config.data).toEqual({ name: 'test', value: 123 })
    })

    test('accepts FormData as data', () => {
        const formData = new FormData()
        formData.append('key', 'value')

        const config: RequestConfiguration = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'POST',
            data: formData,
        }

        expect(config.data).toBe(formData)
    })

    test('accepts all response types', () => {
        const responseTypes: Array<RequestConfiguration['responseType']> = [
            'arraybuffer',
            'blob',
            'document',
            'json',
            'text',
            'stream',
        ]

        responseTypes.forEach((responseType) => {
            const config: RequestConfiguration = {
                backend: 'algod',
                network: Networks.mainnet,
                method: 'GET',
                responseType,
            }

            expect(config.responseType).toBe(responseType)
        })
    })

    test('accepts abort signal', () => {
        const controller = new AbortController()
        const config: RequestConfiguration = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'GET',
            signal: controller.signal,
        }

        expect(config.signal).toBe(controller.signal)
    })

    test('accepts custom headers', () => {
        const config: RequestConfiguration = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'GET',
            headers: {
                'X-Custom-Header': 'value',
                Authorization: 'Bearer token',
            },
        }

        expect(config.headers).toEqual({
            'X-Custom-Header': 'value',
            Authorization: 'Bearer token',
        })
    })

    test('accepts typed data', () => {
        interface CustomData {
            id: number
            name: string
        }

        const config: RequestConfiguration<CustomData> = {
            backend: 'algod',
            network: Networks.mainnet,
            method: 'POST',
            data: { id: 1, name: 'test' },
        }

        expect(config.data).toEqual({ id: 1, name: 'test' })
    })
})

describe('ResponseConfiguration', () => {
    test('represents successful response', () => {
        const response: ResponseConfiguration = {
            data: { result: 'success' },
            status: 200,
            statusText: 'OK',
        }

        expect(response.data).toEqual({ result: 'success' })
        expect(response.status).toBe(200)
        expect(response.statusText).toBe('OK')
    })

    test('accepts typed data', () => {
        interface Account {
            address: string
            balance: number
        }

        const response: ResponseConfiguration<Account> = {
            data: { address: 'ABC123', balance: 1000 },
            status: 200,
            statusText: 'OK',
        }

        expect(response.data.address).toBe('ABC123')
        expect(response.data.balance).toBe(1000)
    })

    test('represents different status codes', () => {
        const statuses = [
            { status: 200, statusText: 'OK' },
            { status: 201, statusText: 'Created' },
            { status: 204, statusText: 'No Content' },
            { status: 400, statusText: 'Bad Request' },
            { status: 404, statusText: 'Not Found' },
            { status: 500, statusText: 'Internal Server Error' },
        ]

        statuses.forEach(({ status, statusText }) => {
            const response: ResponseConfiguration = {
                data: {},
                status,
                statusText,
            }

            expect(response.status).toBe(status)
            expect(response.statusText).toBe(statusText)
        })
    })

    test('accepts array data', () => {
        const response: ResponseConfiguration<string[]> = {
            data: ['item1', 'item2', 'item3'],
            status: 200,
            statusText: 'OK',
        }

        expect(response.data).toHaveLength(3)
        expect(response.data[0]).toBe('item1')
    })

    test('accepts primitive data', () => {
        const stringResponse: ResponseConfiguration<string> = {
            data: 'success',
            status: 200,
            statusText: 'OK',
        }

        expect(stringResponse.data).toBe('success')

        const numberResponse: ResponseConfiguration<number> = {
            data: 42,
            status: 200,
            statusText: 'OK',
        }

        expect(numberResponse.data).toBe(42)
    })
})

describe('ResponseErrorConfiguration', () => {
    test('represents error response', () => {
        const error: ResponseErrorConfiguration = {
            message: 'Request failed',
            code: 'ERR_NETWORK',
        }

        expect(error).toBeDefined()
    })

    test('accepts typed error', () => {
        interface CustomError {
            errorCode: string
            errorMessage: string
            details: string[]
        }

        const error: ResponseErrorConfiguration<CustomError> = {
            errorCode: 'VALIDATION_ERROR',
            errorMessage: 'Invalid input',
            details: ['Field required', 'Invalid format'],
        }

        expect(error.errorCode).toBe('VALIDATION_ERROR')
        expect(error.details).toHaveLength(2)
    })

    test('accepts unknown type', () => {
        const error: ResponseErrorConfiguration = 'Simple error string'

        expect(error).toBe('Simple error string')
    })
})

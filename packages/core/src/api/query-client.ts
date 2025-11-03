import type {
    SearchParamsOption,
    KyInstance,
    KyRequest,
    KyResponse,
    Options,
} from 'ky'
import { useAppStore } from '../store/app-store'
import { config } from '@perawallet/config'

export interface RequestConfig<TData = unknown> {
    url?: string
    method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
    params?: Record<string, unknown>
    data?: TData | FormData
    responseType?:
        | 'arraybuffer'
        | 'blob'
        | 'document'
        | 'json'
        | 'text'
        | 'stream'
    signal?: AbortSignal
    headers?: HeadersInit
}

export interface ResponseConfig<TData = unknown> {
    data: TData
    status: number
    statusText: string
}

export type ResponseErrorConfig<TError = unknown> = TError

export const logRequest = (request: KyRequest) => {
    if (config.debugEnabled) {
        console.log('Sending request', request)
    }
}

export const logResponse = (
    _: KyRequest,
    __: Options,
    response: KyResponse,
) => {
    if (config.debugEnabled) {
        console.log('Received response', response)
    }
}

export const createFetchClient = (clients: Map<string, KyInstance>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return async <TData, _TError = unknown, TVariables = unknown>(
        requestConfig: RequestConfig<TVariables>,
    ): Promise<ResponseConfig<TData>> => {
        if (!requestConfig.url) {
            throw new Error('URL is required')
        }

        const network = useAppStore.getState().network ?? 'testnet'
        const client = clients.get(network)

        if (!client) {
            throw new Error('Could not get KY client')
        }

        try {
            const path = requestConfig.url.startsWith('/')
                ? requestConfig.url.slice(1)
                : requestConfig.url

            const response = await client(path, {
                searchParams: requestConfig.params as SearchParamsOption,
                method: requestConfig.method,
                json: requestConfig.data,
                signal: requestConfig.signal,
                headers: requestConfig.headers,
            })

            const data = await response.json<TData>()

            return {
                data,
                status: response.status,
                statusText: response.statusText,
            }
        } catch (error) {
            if (config.debugEnabled) {
                console.log('Query error', error)
            }
            throw error
        }
    }
}

import type { SearchParamsOption, KyInstance, KyRequest } from 'ky'
import { useAppStore } from '../store/app-store'
import { config } from '../config/main'

function toSearchParamsOption(
    input: Record<string, unknown> | undefined,
): SearchParamsOption {
    const searchParams = new URLSearchParams()

    if (!input) {
        return searchParams
    }

    for (const [key, value] of Object.entries(input)) {
        if (value == null) {
            continue
        }

        if (Array.isArray(value)) {
            for (const val of value) {
                searchParams.append(key, String(val))
            }
            continue
        }

        searchParams.append(key, String(value))
    }

    return searchParams
}

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
        console.log("Sending request", request)
    }
}

export const logResponse = (request: KyRequest) => {
    if (config.debugEnabled) {
        console.log("Received response", request)
    }
}

export const createFetchClient = (clients: Map<string, KyInstance>) => {
    return async <TData, _TError = unknown, TVariables = unknown>(
        requestConfig: RequestConfig<TVariables>,
    ): Promise<ResponseConfig<TData>> => {
        if (!requestConfig.url) {
            throw new Error('URL is required')
        }

        const network = useAppStore(state => state.network) ?? 'testnet'
        const client = clients.get(network)

        if (!client) {
            throw new Error('Could not get KY client')
        }

        const path = requestConfig.url.startsWith('/')
            ? requestConfig.url.slice(1)
            : requestConfig.url

        const response = await client(path, {
            searchParams: toSearchParamsOption(requestConfig.params),
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
    }
}

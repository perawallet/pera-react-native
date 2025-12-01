import { Network } from './base-types'

export type RequestConfiguration<TData = unknown> = {
    backend: 'algod' | 'indexer' | 'pera'
    network: Network
    url?: string
    method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
    params?: object
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

export type ResponseConfiguration<TData = unknown> = {
    data: TData
    status: number
    statusText: string
}

export type ResponseErrorConfiguration<TError = unknown> = TError

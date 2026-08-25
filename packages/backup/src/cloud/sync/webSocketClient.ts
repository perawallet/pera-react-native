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

import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { backupWebSocketUrl } from './webSocketUrl'
import {
    BackupWebSocketMessageReject,
    BackupWebSocketMessageType,
    parseBackupWebSocketMessage,
} from './webSocketMessage'

export type BackupWebSocketEvent =
    | { kind: 'connected' }
    | { kind: 'itemsUpdated'; fromSeq: number; toSeq: number }
    | { kind: 'backupDeleted' }
    | { kind: 'disconnected'; code: number | null; reason: string | null }
    | { kind: 'error'; error: Error }

export type WebSocketLike = {
    onopen: (() => void) | null
    onmessage: ((ev: { data: unknown }) => void) | null
    onerror: ((ev: unknown) => void) | null
    onclose: ((ev: { code?: number; reason?: string }) => void) | null
    close: (code?: number, reason?: string) => void
}

export type BackupSocketFactory = (url: string) => WebSocketLike

type Scheduler = {
    setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => void
}

type ClientParams = {
    baseUrl: string
    backupId: string
    deviceId: string
    timestamp: () => string
    withAuthSecretKey: <T>(fn: (key: Uint8Array) => T) => Promise<Nullable<T>>
    buildToken: (params: {
        backupId: string
        deviceId: string
        timestamp: string
        authSecretKey: Uint8Array
    }) => string
    onEvent: (event: BackupWebSocketEvent) => void
    socketFactory?: BackupSocketFactory
    scheduler?: Scheduler
}

const NORMAL_CLOSE = 1000
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 60_000
const MAX_SHIFT = 5
const JITTER_MAX_MS = 500
const MAX_ATTEMPTS = 10

const defaultFactory: BackupSocketFactory = url =>
    new (globalThis as { WebSocket: new (url: string) => unknown }).WebSocket(
        url,
    ) as unknown as WebSocketLike

const defaultScheduler: Scheduler = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: handle => clearTimeout(handle),
}

export class BackupWebSocketClient {
    private socket: Nullable<WebSocketLike> = null
    private attempt = 0
    private stopped = false
    private reconnectTimer: Nullable<ReturnType<typeof setTimeout>> = null
    private readonly factory: BackupSocketFactory
    private readonly scheduler: Scheduler

    constructor(private readonly params: ClientParams) {
        this.factory = params.socketFactory ?? defaultFactory
        this.scheduler = params.scheduler ?? defaultScheduler
    }

    private backoffMs(): number {
        const shift = Math.min(this.attempt, MAX_SHIFT)
        const base = Math.min(BASE_DELAY_MS * 2 ** shift, MAX_DELAY_MS)
        return base + (this.attempt % (JITTER_MAX_MS + 1))
    }

    async connect(): Promise<void> {
        this.stopped = false
        const timestamp = this.params.timestamp()
        const signature = await this.params.withAuthSecretKey(authSecretKey =>
            this.params.buildToken({
                backupId: this.params.backupId,
                deviceId: this.params.deviceId,
                timestamp,
                authSecretKey,
            }),
        )
        if (!signature) {
            this.params.onEvent({
                kind: 'error',
                error: new Error('Backup auth key unavailable for WS'),
            })
            return
        }
        const url = backupWebSocketUrl({
            baseUrl: this.params.baseUrl,
            backupId: this.params.backupId,
            deviceId: this.params.deviceId,
            timestamp,
            signature,
        })
        const socket = this.factory(url)
        this.socket = socket
        socket.onopen = () => {
            this.attempt = 0
            this.params.onEvent({ kind: 'connected' })
        }
        socket.onmessage = ev => this.handleMessage(ev.data)
        socket.onerror = () =>
            this.params.onEvent({ kind: 'error', error: new Error('WS error') })
        socket.onclose = ev =>
            this.handleClose(ev.code ?? null, ev.reason ?? null)
    }

    private handleMessage(data: unknown): void {
        const parsed = parseBackupWebSocketMessage(data)
        if (!parsed.ok) {
            // An unknown type is expected forward-compat traffic, not a fault.
            if (parsed.reject === BackupWebSocketMessageReject.UnknownType) {
                return
            }
            logger.warn('BackupWebSocketClient: discarded message', {
                reject: parsed.reject,
                type: parsed.type,
            })
            return
        }

        const { message } = parsed
        switch (message.type) {
            case BackupWebSocketMessageType.ITEMS_UPDATED: {
                this.params.onEvent({
                    kind: 'itemsUpdated',
                    fromSeq: message.from_seq,
                    toSeq: message.to_seq,
                })
                return
            }
            case BackupWebSocketMessageType.BACKUP_DELETED: {
                this.params.onEvent({ kind: 'backupDeleted' })
                return
            }
            // `backupDeleted` wipes the on-device keys, so a new message type
            // must never reach it by falling through. Adding one to the schema
            // breaks this line until it is handled explicitly.
            default: {
                return message
            }
        }
    }

    private handleClose(code: number | null, _reason: string | null): void {
        this.socket = null
        this.params.onEvent({ kind: 'disconnected', code, reason: _reason })
        if (this.stopped || code === NORMAL_CLOSE) return
        if (this.attempt >= MAX_ATTEMPTS) {
            this.params.onEvent({
                kind: 'error',
                error: new Error('WS max reconnect attempts reached'),
            })
            return
        }
        const delay = this.backoffMs()
        this.attempt += 1
        this.reconnectTimer = this.scheduler.setTimeout(() => {
            if (!this.stopped) void this.connect()
        }, delay)
    }

    disconnect(): void {
        this.stopped = true
        if (this.reconnectTimer != null) {
            this.scheduler.clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        this.socket?.close(NORMAL_CLOSE)
        this.socket = null
    }
}

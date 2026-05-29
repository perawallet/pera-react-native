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

/*
 * Ported from @algorandfoundation/liquid-auth-js (Apache-2.0):
 * https://github.com/algorandfoundation/liquid-auth-js — trimmed to the
 * SignalClient transport (Socket.IO signaling + WebRTC peer/data channel).
 * QR-code (canvas) and attestation/deeplink helpers were intentionally dropped.
 */

import {
    io,
    type ManagerOptions,
    type Socket,
    type SocketOptions,
} from 'socket.io-client'
import { EventEmitter } from 'eventemitter3'
import { v7 as uuidv7 } from 'uuid'

export type LinkMessage = {
    credId?: string
    requestId?: string
    wallet?: string
}

const REQUEST_IN_PROCESS_MESSAGE = 'Request in process'
const UNAUTHENTICATED_MESSAGE = 'Not authenticated'

/** Minimal Socket.IO + WebRTC signaling client. The wallet calls peer(id, 'answer', config). */
export class SignalClient extends EventEmitter {
    type: 'offer' | 'answer' = 'answer'
    authenticated = false
    private requestId: string | undefined
    peerClient: RTCPeerConnection | undefined
    socket: Socket

    constructor(
        url: string,
        options: Partial<ManagerOptions & SocketOptions> = {
            autoConnect: true,
        },
    ) {
        super()
        this.socket = io(url, options)
        this.socket.on('connect', () => this.emit('connect', this.socket.id))
        this.socket.on('disconnect', () =>
            this.emit('disconnect', this.socket.id),
        )
    }

    static generateRequestId(): string {
        return uuidv7()
    }

    async peer(
        requestId: string | undefined,
        type: 'offer' | 'answer',
        config: RTCConfiguration,
    ): Promise<RTCDataChannel> {
        if (typeof this.requestId !== 'undefined')
            throw new Error(REQUEST_IN_PROCESS_MESSAGE)

        // Sync executor wrapping an async IIFE: avoids the async-Promise-executor
        // anti-pattern and ensures a thrown link/signal/SDP error rejects the
        // promise instead of leaving it forever pending.
        return new Promise<RTCDataChannel>((resolve, reject) => {
            void (async () => {
                try {
                    let candidatesBuffer: RTCIceCandidateInit[] = []
                    this.peerClient = new RTCPeerConnection(config)
                    this.type = type === 'offer' ? 'answer' : 'offer'

                    if (type === 'offer') await this.link(requestId as string)

                    this.peerClient.onicecandidate = event => {
                        if (event.candidate) {
                            this.emit(
                                `${this.type}-candidate`,
                                event.candidate.toJSON(),
                            )
                            this.socket.emit(
                                `${this.type}-candidate`,
                                event.candidate.toJSON(),
                            )
                        }
                    }

                    this.socket.on(
                        `${type}-candidate`,
                        async (candidate: RTCIceCandidateInit) => {
                            if (this.peerClient?.remoteDescription) {
                                this.emit(`${type}-candidate`, candidate)
                                await this.peerClient.addIceCandidate(
                                    new RTCIceCandidate(candidate),
                                )
                            } else {
                                candidatesBuffer.push(candidate)
                            }
                        },
                    )

                    this.peerClient.ondatachannel = event => {
                        this.emit('data-channel', event.channel)
                        resolve(event.channel)
                    }

                    if (type === 'offer') {
                        const sdp = await this.signal(type)
                        await this.peerClient.setRemoteDescription(sdp)
                        const answer = await this.peerClient.createAnswer()
                        await this.peerClient.setLocalDescription(answer)
                        await this.flushCandidates(candidatesBuffer, type)
                        candidatesBuffer = []
                        this.emit(`${this.type}-description`, answer.sdp)
                        this.socket.emit(`${this.type}-description`, answer.sdp)
                    } else {
                        const dataChannel =
                            this.peerClient.createDataChannel('liquid')
                        const localSdp = await this.peerClient.createOffer()
                        await this.peerClient.setLocalDescription(localSdp)
                        this.socket.emit(
                            `${this.type}-description`,
                            localSdp.sdp,
                        )
                        this.emit(`${this.type}-description`, localSdp.sdp)
                        const sdp = await this.signal(type)
                        await this.peerClient.setRemoteDescription(sdp)
                        await this.flushCandidates(candidatesBuffer, type)
                        candidatesBuffer = []
                        this.emit('data-channel', dataChannel)
                        resolve(dataChannel)
                    }
                } catch (error) {
                    reject(
                        error instanceof Error
                            ? error
                            : new Error(String(error)),
                    )
                }
            })()
        })
    }

    private async flushCandidates(
        buffer: RTCIceCandidateInit[],
        type: 'offer' | 'answer',
    ): Promise<void> {
        if (buffer.length === 0) return
        await Promise.all(
            buffer.map(async candidate => {
                this.emit(`${type}-candidate`, candidate)
                await this.peerClient?.addIceCandidate(
                    new RTCIceCandidate(candidate),
                )
            }),
        )
    }

    async link(requestId: string): Promise<LinkMessage> {
        if (typeof this.requestId !== 'undefined')
            throw new Error(REQUEST_IN_PROCESS_MESSAGE)
        this.requestId = requestId
        this.emit('link', { requestId })

        return new Promise<LinkMessage>(resolve => {
            this.socket.emit(
                'link',
                { requestId },
                ({ data }: { data: LinkMessage }) => {
                    this.authenticated = true
                    delete this.requestId
                    this.emit('link-message', data)
                    resolve(data)
                },
            )
        })
    }

    async signal(type: 'offer' | 'answer'): Promise<RTCSessionDescriptionInit> {
        if (!this.authenticated) throw new Error(UNAUTHENTICATED_MESSAGE)
        this.emit('signal', { type })
        return new Promise<RTCSessionDescriptionInit>(resolve => {
            this.socket.once(`${type}-description`, (sdp: string) => {
                const description = { type, sdp } as RTCSessionDescriptionInit
                this.emit(`${type}-description`, description)
                resolve(description)
            })
        })
    }

    close(disconnect = false): void {
        this.socket.removeAllListeners()
        delete this.requestId
        this.authenticated = false
        if (disconnect) this.socket.disconnect()
        this.emit('close')
    }
}

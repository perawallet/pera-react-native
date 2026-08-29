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

// Minimal WC v1 bridge for e2e: pub/sub over topics with offline queueing.
// The real Pera bridge queues while a topic has no live subscriber and
// flushes once one subscribes (confirmed with the bridge owner); this
// mirrors that so the suite's queue-and-flush pairing path is genuinely
// exercised rather than assumed: test 1's dApp peer publishes
// wc_sessionRequest via createSession() before offscreen has subscribed to
// the handshake topic (pairing there is async), so it queues and is only
// delivered once offscreen's 'sub' frame lands. This fixture never kills or
// revives an already-live socket — no test in this suite exercises that —
// so it makes no claim about that path. Every message frame this file sees
// on the wire is exactly what @perawallet/walletconnect's SocketTransport
// sends/expects ({ topic, type: 'sub' | 'pub' | 'ack', payload, silent }),
// so this is wire-compatible with the real client used on both the wallet
// (extension) and dApp (test fixture) sides — no hand-rolled WC v1 framing
// anywhere in this repo.
import { WebSocketServer } from 'ws'

export const startFakeBridge = async () => {
    const wss = new WebSocketServer({ port: 0 })
    await new Promise(resolve => wss.once('listening', resolve))
    const { port } = wss.address()

    // WCDIAG: temporary instrumentation, remove before commit.
    const t0 = Date.now()
    const diag = (...args) =>
        console.log(`[WCDIAG +${Date.now() - t0}ms]`, ...args)
    diag('bridge listening on', port)

    const subscribers = new Map() // topic -> Set<ws>
    const queues = new Map() // topic -> payload[]

    const deliver = (topic, payload) => {
        const live = subscribers.get(topic)
        if (live && live.size > 0) {
            diag(
                `DELIVER topic=${String(topic).slice(0, 12)} to ${live.size} subscriber(s)`,
            )
            for (const socket of live) socket.send(JSON.stringify(payload))
            return
        }
        diag(`QUEUE topic=${String(topic).slice(0, 12)} (no subscriber)`)
        if (!queues.has(topic)) queues.set(topic, [])
        queues.get(topic).push(payload)
    }

    let socketSeq = 0
    wss.on('connection', socket => {
        const sid = ++socketSeq
        diag(`socket#${sid} CONNECTED`)
        socket.on('close', () => diag(`socket#${sid} CLOSED`))
        socket.on('error', e => diag(`socket#${sid} ERROR`, e?.message))
        socket.on('message', raw => {
            let frame
            try {
                frame = JSON.parse(raw.toString())
            } catch {
                return
            }
            diag(
                `socket#${sid} <- ${frame.type} topic=${String(frame.topic).slice(0, 12)} payloadLen=${String(frame.payload ?? '').length}`,
            )
            if (frame.type === 'sub') {
                if (!subscribers.has(frame.topic)) {
                    subscribers.set(frame.topic, new Set())
                }
                subscribers.get(frame.topic).add(socket)
                const queued = queues.get(frame.topic) ?? []
                queues.set(frame.topic, [])
                diag(
                    `socket#${sid} SUBSCRIBED topic=${String(frame.topic).slice(0, 12)} flushing=${queued.length}`,
                )
                for (const payload of queued) {
                    socket.send(JSON.stringify(payload))
                }
                return
            }
            if (frame.type === 'pub') {
                deliver(frame.topic, frame)
            }
            // 'ack' frames (sent by the real client on every message it
            // receives) are intentionally ignored, same as a real bridge
            // would treat a delivery acknowledgement it doesn't need to act
            // on.
        })
        socket.on('close', () => {
            for (const set of subscribers.values()) set.delete(socket)
        })
    })

    return {
        url: `ws://127.0.0.1:${port}`,
        // wss.close()'s callback only fires once every client socket is gone,
        // and the extension's offscreen connector stays connected for the
        // whole browser session by design — so terminate live sockets first
        // or afterAll hangs until Playwright's hook timeout.
        close: () =>
            new Promise(resolve => {
                for (const socket of wss.clients) socket.terminate()
                wss.close(() => resolve())
            }),
    }
}

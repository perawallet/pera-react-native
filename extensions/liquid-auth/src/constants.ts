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

import type { IceServerConfig } from './types'

/**
 * Default ICE servers for the WebRTC peer connection: STUN for direct NAT
 * traversal plus TURN as the relay fallback. Phone↔browser peers are almost
 * always on different NATs, so STUN alone can't establish the data channel —
 * a TURN relay is required for the connection to open at all.
 *
 * These are the public Nodely/Algonode TURN servers (the same ones Rocca and
 * use-wallet's Liquid provider use against debug.liquidauth.com). The
 * `liquid-auth` credential is a shared public test credential — BEFORE
 * PRODUCTION, replace this with Pera-operated TURN (or fetch ICE config at
 * runtime); do not ship a shared public TURN credential in a release.
 */
export const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
    {
        urls: [
            'stun:geo.turn.algonode.xyz:80',
            'stun:global.turn.nodely.io:443',
        ],
    },
    {
        urls: [
            'turn:geo.turn.algonode.xyz:80?transport=tcp',
            'turns:global.turn.nodely.io:443?transport=tcp',
        ],
        username: 'liquid-auth',
        credential: 'sqmcP4MiTKMT4TGEDSk9jgHY',
    },
]

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000

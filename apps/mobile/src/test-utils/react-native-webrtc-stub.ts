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

/**
 * Test stub for `react-native-webrtc`. The published module ships Flow-typed
 * native ESM (`import typeof …`) that vitest's transformer can't parse, and
 * WebRTC has no meaning under jsdom. The Liquid Auth extension's
 * `bootstrap.ts` imports `registerGlobals` from here, so the real module is
 * pulled into the dependency graph the moment the provider barrel is loaded by
 * the integration setup. Liquid Auth tests drive a mocked data-channel
 * transport, so a no-op `registerGlobals` plus inert RTC globals are enough.
 */

export const registerGlobals = (): void => {}

export class RTCPeerConnection {}
export class RTCIceCandidate {}
export class RTCSessionDescription {}
export class RTCDataChannel {}
export class MediaStream {}
export class MediaStreamTrack {}

export default {
    registerGlobals,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCDataChannel,
    MediaStream,
    MediaStreamTrack,
}

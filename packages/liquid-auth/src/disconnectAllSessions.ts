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

import { useLiquidAuthRegistryStore } from './store/registryStore'
import { useLiquidAuthStore } from './store/store'

/**
 * Disconnects every Liquid Auth session: closes and forgets all live clients
 * (releasing their WebRTC connections) and clears the session records so they
 * leave Connected Apps. Use for the "disconnect all" action — clearing only the
 * session records would leave the clients connected and dApps still able to
 * send requests. The durable credential registry is intentionally kept so a
 * later reconnect reuses the existing passkeys.
 */
export const disconnectAllLiquidAuthSessions = (): void => {
    useLiquidAuthRegistryStore.getState().resetState()
    useLiquidAuthStore.getState().setSessions([])
}

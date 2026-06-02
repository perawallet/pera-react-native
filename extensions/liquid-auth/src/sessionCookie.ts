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
 * Structural subset of `@react-native-cookies/cookies` get() used here. Declared
 * so tests can inject a fake reader without the native module.
 */
export type CookieReader = {
    get(url: string): Promise<Record<string, { value: string } | undefined>>
}

/**
 * Reads the express-session cookie the FIDO ceremony set in the native cookie
 * jar for `origin`, formatted as a request header value (`connect.sid=<value>`).
 *
 * The liquid-auth signaling gateway joins each socket to a socket.io room named
 * by the express-session id (read from `connect.sid` on the handshake) and
 * relays offer/answer only within that room. Without this cookie the wallet's
 * socket lands in an empty room and never receives the dApp's answer.
 *
 * Defensive: never throws (returns undefined on error). If `connect.sid` is
 * absent but exactly one cookie is present, falls back to that one — the
 * server's session cookie name may differ from the express default. Logs cookie
 * NAMES only (never values).
 */
export const readLiquidAuthSessionCookieWith = async (
    cookieManager: CookieReader,
    origin: string,
): Promise<string | undefined> => {
    try {
        const cookies = await cookieManager.get(origin)
        const names = Object.keys(cookies ?? {})
        const sid = cookies?.['connect.sid']
        let header: string | undefined
        if (sid?.value) {
            header = `connect.sid=${sid.value}`
        } else if (names.length === 1) {
            const only = cookies[names[0]]
            if (only?.value) header = `${names[0]}=${only.value}`
        }
        return header
    } catch {
        return undefined
    }
}

export const readLiquidAuthSessionCookie = async (
    origin: string,
): Promise<string | undefined> => {
    // Lazy import so merely loading this module (e.g. via the package barrel
    // in a jsdom test run) never touches the native cookie module.
    const { default: cookieManager } =
        await import('@react-native-cookies/cookies')
    return readLiquidAuthSessionCookieWith(
        cookieManager as CookieReader,
        origin,
    )
}

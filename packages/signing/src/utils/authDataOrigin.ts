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

const hostFromMaybeUrl = (value: string): string => {
    const trimmed = value.trim().toLowerCase()
    // A bare authority with a port ("example.io:8080", the shape of a sign-in
    // `domain`) parses as a URL with the host in the *scheme* position and an
    // empty host, so prefix a scheme unless the value clearly carries one.
    const candidate = trimmed.includes('//') ? trimmed : `https://${trimmed}`
    try {
        const url = new URL(candidate)
        // Userinfo smuggling ("trusted.com@evil.com") is never legitimate in
        // a sign-in domain or an observed origin; return the raw string so the
        // comparison fails safe (warns).
        if (url.username || url.password) {
            return trimmed
        }
        return url.host
    } catch {
        return trimmed
    }
}

/**
 * A self-asserted sign-in `domain` that differs from the platform-observed
 * origin is the signature of a relay/phishing attempt (origin A coaxing a
 * challenge bound to domain B). `verifiedOrigin` must never be a
 * dApp-asserted value; absent one (WalletConnect, where the peer URL is
 * self-asserted) this is false.
 */
export const isAuthDataOriginMismatch = (
    domain: string,
    verifiedOrigin: string | undefined,
): boolean => {
    if (!verifiedOrigin) {
        return false
    }
    return hostFromMaybeUrl(domain) !== hostFromMaybeUrl(verifiedOrigin)
}

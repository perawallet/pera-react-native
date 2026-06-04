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

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

const ALGORAND_ADDRESS_RE = /^[A-Z2-7]{58}$/

export const shouldUseStackedLayout = (value: unknown): boolean => {
    if (value instanceof Uint8Array) return true
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.length > 32
    return value !== null && typeof value === 'object'
}

export const formatDebugValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(null)'
    if (value instanceof Uint8Array) {
        if (value.length === 0) return 'Uint8Array(0) []'
        const preview = Array.from(value.slice(0, 8))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ')
        return `Uint8Array(${value.length}) [${preview}${value.length > 8 ? ' …' : ''}]`
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]'
        try {
            return JSON.stringify(value)
        } catch {
            return `Array(${value.length})`
        }
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') {
        if (value.length === 0) return '""'
        if (ALGORAND_ADDRESS_RE.test(value))
            return truncateAlgorandAddress(value)
        return value
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch {
            return '[Object]'
        }
    }
    return String(value)
}

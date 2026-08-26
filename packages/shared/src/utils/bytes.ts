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

// JSON round-tripping a byte field produces one of two shapes depending on the
// source: a plain Uint8Array loses its identity to an index-keyed object, while
// Buffer.prototype.toJSON intercepts first and yields { type: 'Buffer', data }.
export const toBytes = (value: unknown): Uint8Array | undefined => {
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value)
    }

    if (ArrayBuffer.isView(value)) {
        // ArrayBuffer.isView checks an internal slot rather than the
        // prototype chain, so it still recognizes typed arrays (e.g. Buffer)
        // constructed in a different realm than this module's Uint8Array.
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    }

    if (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'Buffer' &&
        'data' in value &&
        Array.isArray(value.data)
    ) {
        return new Uint8Array(value.data)
    }

    return undefined
}

export const decodeBytesToText = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value ? value : undefined
    }

    const bytes = toBytes(value)
    if (!bytes) {
        return undefined
    }

    const text = new TextDecoder().decode(bytes)

    return text ? text : undefined
}

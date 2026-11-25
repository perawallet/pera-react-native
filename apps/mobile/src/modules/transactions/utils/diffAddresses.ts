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

export type AddressSegment = { text: string; isDifferent: boolean }

const segmentsOf = (address: string, other: string): AddressSegment[] => {
    const segments: AddressSegment[] = []
    for (let index = 0; index < address.length; index++) {
        const char = address[index]
        // Case-blind: a checksum's letter case is not a difference a reader checks.
        const isDifferent = char.toLowerCase() !== other[index]?.toLowerCase()
        const last = segments.at(-1)
        if (last && last.isDifferent === isDifferent) {
            last.text += char
        } else {
            segments.push({ text: char, isDifferent })
        }
    }
    return segments
}

/** Splits two addresses into runs that match or differ position by position. */
export const diffAddresses = (
    a: string,
    b: string,
): { a: AddressSegment[]; b: AddressSegment[] } => ({
    a: segmentsOf(a, b),
    b: segmentsOf(b, a),
})

/**
 * Cuts one address's runs into display groups of `groupSize` characters,
 * counted from the end so only the first group can be shorter. Both addresses
 * of a pair are the same length, so they break at the same places.
 */
export const groupAddressSegments = (
    segments: AddressSegment[],
    groupSize = 4,
): AddressSegment[][] => {
    const size = Math.max(1, Math.floor(groupSize))
    const total = segments.reduce((sum, { text }) => sum + text.length, 0)
    let room = total % size || size
    const groups: AddressSegment[][] = []
    let current: AddressSegment[] = []

    for (const { text, isDifferent } of segments) {
        let rest = text
        while (rest.length > 0) {
            const taken = rest.slice(0, room)
            current.push({ text: taken, isDifferent })
            rest = rest.slice(taken.length)
            room -= taken.length
            if (room === 0) {
                groups.push(current)
                current = []
                room = size
            }
        }
    }
    if (current.length > 0) groups.push(current)

    return groups
}

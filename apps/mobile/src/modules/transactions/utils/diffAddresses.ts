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

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

export type AddressSegment = { text: string; isMatch: boolean }

type Range = [start: number, end: number]

// Codecs shorten an address to `head...tail`.
const ELLIPSIS = '...'

/**
 * Splits the short form of `address` into runs, marking where `query` matched.
 * A match in the middle the short form hides is spliced in between head and
 * tail, so the highlighted part is always visible.
 */
export const addressMatchSegments = (
    address: string,
    truncated: string,
    query: string,
): AddressSegment[] => {
    const matchStart = address.toLowerCase().indexOf(query.toLowerCase())
    if (matchStart === -1 || query.length === 0) {
        return [{ text: truncated, isMatch: false }]
    }
    const match: Range = [matchStart, matchStart + query.length]

    const ellipsisAt = truncated.indexOf(ELLIPSIS)
    const visible: Range[] =
        ellipsisAt === -1
            ? [[0, address.length]]
            : [
                  [0, ellipsisAt],
                  [
                      address.length -
                          (truncated.length - ellipsisAt - ELLIPSIS.length),
                      address.length,
                  ],
              ]

    // A match that spans the whole hidden middle would splice in every
    // character and push the network name off a one-line row, so it marks the
    // short form instead.
    if (ellipsisAt !== -1) {
        const tailLength = truncated.length - ellipsisAt - ELLIPSIS.length
        const tailStart = address.length - tailLength
        if (match[0] <= ellipsisAt && match[1] >= tailStart) {
            const from = match[0]
            const to = truncated.length - (address.length - match[1])
            return [
                { text: truncated.slice(0, from), isMatch: false },
                { text: truncated.slice(from, to), isMatch: true },
                { text: truncated.slice(to), isMatch: false },
            ].filter(segment => segment.text.length > 0)
        }
    }

    const merged: Range[] = []
    for (const range of [...visible, match].sort((a, b) => a[0] - b[0])) {
        const last = merged.at(-1)
        if (last && range[0] <= last[1]) {
            last[1] = Math.max(last[1], range[1])
        } else {
            merged.push([...range])
        }
    }

    const segments: AddressSegment[] = []
    const push = (text: string, isMatch: boolean) => {
        if (text.length === 0) return
        const last = segments.at(-1)
        if (last?.isMatch === isMatch) last.text += text
        else segments.push({ text, isMatch })
    }
    merged.forEach(([start, end], index) => {
        if (index > 0) push(ELLIPSIS, false)
        const from = Math.max(start, match[0])
        const to = Math.min(end, match[1])
        if (from >= to) {
            push(address.slice(start, end), false)
            return
        }
        push(address.slice(start, from), false)
        push(address.slice(from, to), true)
        push(address.slice(to, end), false)
    })
    return segments
}

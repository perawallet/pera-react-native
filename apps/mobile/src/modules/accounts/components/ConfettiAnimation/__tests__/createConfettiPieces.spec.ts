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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { createConfettiPieces } from '../createConfettiPieces'

const DIMENSIONS = { width: 400, height: 800 }
const COLORS = ['#111111', '#222222', '#333333']

describe('createConfettiPieces', () => {
    it('creates the requested number of pieces with unique sequential ids', () => {
        const pieces = createConfettiPieces(20, DIMENSIONS, COLORS)

        expect(pieces).toHaveLength(20)
        expect(pieces.map(piece => piece.id)).toEqual(
            Array.from({ length: 20 }, (_, index) => index),
        )
    })

    it('only assigns colors from the provided palette', () => {
        const pieces = createConfettiPieces(30, DIMENSIONS, COLORS)

        pieces.forEach(piece => {
            expect(COLORS).toContain(piece.color)
        })
    })

    it('fires from two cannons just off the left and right edges', () => {
        const pieces = createConfettiPieces(50, DIMENSIONS, COLORS)

        expect(pieces.some(piece => piece.originX < 0)).toBe(true)
        expect(pieces.some(piece => piece.originX > DIMENSIONS.width)).toBe(
            true,
        )
    })

    it('aims each muzzle at 45° up-and-inward', () => {
        const pieces = createConfettiPieces(50, DIMENSIONS, COLORS)

        pieces.forEach(piece => {
            const inwardLeg = Math.abs(piece.launchControlX - piece.originX)
            const upLeg = piece.originY - piece.launchControlY

            // Fires upward…
            expect(upLeg).toBeGreaterThan(0)
            // …at 45° — equal inward and upward legs.
            expect(inwardLeg).toBeCloseTo(upLeg)
            // …toward screen centre, away from its edge.
            const aimsInward =
                piece.originX < 0
                    ? piece.launchControlX > piece.originX
                    : piece.launchControlX < piece.originX
            expect(aimsInward).toBe(true)
        })
    })

    it('bursts and lands within the screen width', () => {
        const pieces = createConfettiPieces(50, DIMENSIONS, COLORS)

        pieces.forEach(piece => {
            expect(piece.burstX).toBeGreaterThanOrEqual(0)
            expect(piece.burstX).toBeLessThanOrEqual(DIMENSIONS.width)
            expect(piece.fallX).toBeGreaterThanOrEqual(0)
            expect(piece.fallX).toBeLessThanOrEqual(DIMENSIONS.width)
        })
    })

    it('peaks the burst high on the screen, above the cannons', () => {
        const pieces = createConfettiPieces(50, DIMENSIONS, COLORS)

        pieces.forEach(piece => {
            // Mass forms in the top fifth of the screen…
            expect(piece.burstY).toBeLessThan(DIMENSIONS.height * 0.2)
            // …higher than the muzzle it was fired from.
            expect(piece.burstY).toBeLessThan(piece.originY)
        })
    })

    it('culls flakes partway down, never at the floor', () => {
        const pieces = createConfettiPieces(50, DIMENSIONS, COLORS)

        pieces.forEach(piece => {
            // Fades in as it descends past the burst, before the bottom.
            expect(piece.cullStartY).toBeGreaterThan(piece.burstY)
            expect(piece.cullStartY).toBeLessThan(piece.cullEndY)
            // Fully gone well above the bottom of the screen.
            expect(piece.cullEndY).toBeLessThan(DIMENSIONS.height * 0.8)
        })
    })

    it('produces positive, animatable timing and sizing', () => {
        const pieces = createConfettiPieces(50, DIMENSIONS, COLORS)

        pieces.forEach(piece => {
            expect(piece.durationMs).toBeGreaterThan(0)
            expect(piece.delayMs).toBeGreaterThanOrEqual(0)
            expect(piece.width).toBeGreaterThan(0)
            expect(piece.height).toBeGreaterThan(0)
        })
    })

    it('mixes chunks, slices and specks for a varied look', () => {
        const kinds = new Set(
            createConfettiPieces(150, DIMENSIONS, COLORS).map(
                piece => piece.kind,
            ),
        )

        expect(kinds).toEqual(new Set(['chunk', 'slice', 'speck']))
    })

    it('tumbles on all three axes in both directions', () => {
        const pieces = createConfettiPieces(150, DIMENSIONS, COLORS)

        ;(['spinX', 'spinY', 'spinZ'] as const).forEach(axis => {
            expect(pieces.some(piece => piece[axis] > 0)).toBe(true)
            expect(pieces.some(piece => piece[axis] < 0)).toBe(true)
        })
    })

    it('returns an empty set when no pieces are requested', () => {
        expect(createConfettiPieces(0, DIMENSIONS, COLORS)).toEqual([])
    })
})

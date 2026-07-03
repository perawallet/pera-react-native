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

/** Visual size family of a flake — drives the varied look. */
export type ConfettiPieceKind = 'chunk' | 'slice' | 'speck'

/**
 * One confetti flake's static parameters. Motion is two-phase and derived from
 * these on the UI thread: an explosive launch from a side cannon to a burst
 * point near screen centre, then a gentler gravity-style drop to the fall target.
 */
export type ConfettiPieceConfig = {
    id: number
    kind: ConfettiPieceKind
    /** Muzzle position — just off the left or right edge, ~1/3 down the screen. */
    originX: number
    originY: number
    /** Control point for the launch arc — sets the muzzle exit to 45° up-and-inward. */
    launchControlX: number
    launchControlY: number
    /** Apex of the explosion — clustered around the horizontal centre line. */
    burstX: number
    burstY: number
    /** Where the flake drifts to as it falls — spread evenly across the width. */
    fallX: number
    /** Y the flake falls toward — just past the screen bottom (keeps fall speed natural). */
    fallTargetY: number
    /** Y where the flake starts fading as it falls. */
    cullStartY: number
    /** Y where the flake has fully faded — it never reaches the bottom. */
    cullEndY: number
    color: string
    width: number
    height: number
    borderRadius: number
    /** Fraction of the flight spent in the explosive launch phase (0..1). */
    launchFraction: number
    /** Total flight duration in ms. */
    durationMs: number
    /** Stagger before this flake fires, in ms — kept tight so both cannons read as one blast. */
    delayMs: number
    /** Horizontal flutter peak in px during the fall. */
    swayAmplitude: number
    /** Flutter oscillations over the full flight. */
    swayFrequency: number
    /** Signed full rotations over the flight, per axis — flakes tumble in 3D. */
    spinX: number
    spinY: number
    spinZ: number
    /** Starting angle (deg) per axis so flakes don't all begin face-on. */
    initialX: number
    initialY: number
    initialZ: number
}

type Dimensions = { width: number; height: number }

// Cannon placement.
const CANNON_Y_MIN = 0.24 // a little above ~1/3 down the screen…
const CANNON_Y_MAX = 0.32 // …kept in the upper third.
const CANNON_EDGE_OFFSET = 0.08 // muzzle sits well off-screen past each edge.
// 45° muzzle exit: equal upward and inward legs, sized as a fraction of height (px).
const LAUNCH_LEG = 0.2

// Burst (apex) shaping — the mass forms high so confetti almost reaches the top
// before dropping the full height of the screen.
const BURST_SPREAD = 0.4 // ±40% of width around centre → ~80% coverage.
const BURST_Y_MIN = 0.05 // mass peaks near the top…
const BURST_Y_MAX = 0.16 // …of the screen.

// Fall dispersion — flakes spread evenly across the width as they drop.
const FALL_X_MIN = 0.08
const FALL_X_MAX = 0.92
const FALL_BUFFER = 60 // px past the bottom edge the fall aims for (keeps speed natural).

// Cull band — flakes fade out partway down, ~30–40% up from the bottom, like the
// reference animation, rather than riding all the way to the floor.
const CULL_START_MIN = 0.48 // begin fading around mid-screen…
const CULL_START_MAX = 0.56
const CULL_BAND_MIN = 0.1 // …fully gone within this much further down.
const CULL_BAND_MAX = 0.16

const randomInRange = (min: number, max: number): number =>
    min + Math.random() * (max - min)

// Triangular distribution on [-1, 1], peaked at 0 — concentrates the mass near centre.
const triangular = (): number => Math.random() + Math.random() - 1

const randomSign = (): number => (Math.random() < 0.5 ? -1 : 1)

const pickSize = (): Pick<
    ConfettiPieceConfig,
    'kind' | 'width' | 'height' | 'borderRadius'
> => {
    const roll = Math.random()

    if (roll < 0.28) {
        // Chunky rectangles.
        return {
            kind: 'chunk',
            width: randomInRange(9, 15),
            height: randomInRange(13, 22),
            borderRadius: randomInRange(0, 2),
        }
    }

    if (roll < 0.64) {
        // Thin streamer slices.
        return {
            kind: 'slice',
            width: randomInRange(3, 6),
            height: randomInRange(12, 22),
            borderRadius: randomInRange(0, 1.5),
        }
    }

    // Tiny round specks.
    const speck = randomInRange(3, 6)

    return {
        kind: 'speck',
        width: speck,
        height: speck,
        borderRadius: speck / 2,
    }
}

export const createConfettiPieces = (
    count: number,
    { width, height }: Dimensions,
    colors: string[],
): ConfettiPieceConfig[] =>
    Array.from({ length: count }, (_, id) => {
        // Alternate cannons so both sides fire roughly equal volleys.
        const fromLeft = id % 2 === 0
        const inwardDir = fromLeft ? 1 : -1
        const originX = fromLeft
            ? -CANNON_EDGE_OFFSET * width
            : (1 + CANNON_EDGE_OFFSET) * width
        const originY = randomInRange(CANNON_Y_MIN, CANNON_Y_MAX) * height
        // Equal up/inward legs (px) → a true 45° exit on screen.
        const leg = LAUNCH_LEG * height
        const cullStartY =
            randomInRange(CULL_START_MIN, CULL_START_MAX) * height

        return {
            id,
            ...pickSize(),
            originX,
            originY,
            launchControlX: originX + inwardDir * leg,
            launchControlY: originY - leg,
            burstX: width / 2 + triangular() * BURST_SPREAD * width,
            burstY: randomInRange(BURST_Y_MIN, BURST_Y_MAX) * height,
            fallX: randomInRange(FALL_X_MIN, FALL_X_MAX) * width,
            fallTargetY: height + FALL_BUFFER,
            cullStartY,
            cullEndY:
                cullStartY +
                randomInRange(CULL_BAND_MIN, CULL_BAND_MAX) * height,
            color: colors[Math.floor(Math.random() * colors.length)],
            launchFraction: randomInRange(0.12, 0.18),
            durationMs: randomInRange(2600, 3800),
            delayMs: randomInRange(0, 140),
            swayAmplitude: randomInRange(6, 22),
            swayFrequency: randomInRange(0.8, 2.4),
            // Z spins fastest (in-plane), X/Y give the tumbling flip.
            spinX: randomInRange(1, 3) * randomSign(),
            spinY: randomInRange(1, 3) * randomSign(),
            spinZ: randomInRange(2, 5) * randomSign(),
            initialX: randomInRange(0, 360),
            initialY: randomInRange(0, 360),
            initialZ: randomInRange(0, 360),
        }
    })

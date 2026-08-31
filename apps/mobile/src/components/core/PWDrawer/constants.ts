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

/**
 * Leaves a sliver of the covered screen visible, so the content still reads as
 * a layer sitting on top rather than a full-screen replacement.
 */
export const PWDRAWER_WIDTH_RATIO = 0.92

/**
 * Width of the closed-state grab strip, in px. Everything under it is
 * unreachable while the drawer is closed, so it stays narrow — see
 * PWDrawerGestureSurface for why the strip has to own these touches outright.
 */
export const PWDRAWER_EDGE_WIDTH = 24

/** Horizontal travel, in px, before the drag starts following the finger. */
export const PWDRAWER_ACTIVATION_OFFSET = 10

/** Vertical travel, in px, that abandons the drag so a mis-aimed swipe is inert. */
export const PWDRAWER_VERTICAL_CANCEL_OFFSET = 24

/**
 * Release velocity, px/s, that commits the drawer regardless of how far it
 * travelled — so a quick flick opens without dragging past the halfway point.
 */
export const PWDRAWER_FLING_VELOCITY = 500

/** Progress past which a slow release settles open rather than closed. */
export const PWDRAWER_COMMIT_THRESHOLD = 0.5

export const PWDRAWER_SPRING_CONFIG = {
    damping: 40,
    stiffness: 350,
    mass: 1,
    overshootClamping: true,
} as const

/**
 * Peak tint over the content, at fully open, and the only cue separating the two
 * layers. An order of magnitude lighter than a modal backdrop (0.64): the
 * content should read as shaded by the layer above it, not dimmed out of use.
 */
export const PWDRAWER_SCRIM_OPACITY = 0.3

/**
 * Ramps the panel contents grow and fade in on, keyed off progress so a
 * finger-tracked drag passes through the same curve a flick does. Sampled
 * quadratic ease-out rather than composed from `Easing`, which keeps them a
 * plain `interpolate` with no easing function captured into the worklet.
 *
 * Scale peaks 2% over full size before settling — much more reads as a bounce.
 * Opacity has no overshoot, since above 1 isn't a value.
 */
export const PWDRAWER_CONTENT_SCALE_PROGRESS = [0, 0.25, 0.5, 0.75, 0.88, 1]
export const PWDRAWER_CONTENT_SCALE_VALUES = [0.9, 0.955, 0.985, 1.008, 1.01, 1]
export const PWDRAWER_CONTENT_OPACITY_PROGRESS = [0, 0.25, 0.5, 0.75, 1]
export const PWDRAWER_CONTENT_OPACITY_VALUES = [0.2, 0.5, 0.875, 0.97, 1]

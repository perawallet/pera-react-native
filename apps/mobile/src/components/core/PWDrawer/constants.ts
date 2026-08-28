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
export const PWDRAWER_WIDTH_RATIO = 0.9

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
 * Progress over which the content's left shadow fades in. Short, so the shadow
 * is established as soon as the panel is revealed rather than ramping with the
 * whole drag; kept non-zero so nothing bleeds at the screen edge when closed.
 */
export const PWDRAWER_SHADOW_FADE_PROGRESS = 0.12

/**
 * Just enough to read as a seam rather than a drop shadow. Paired with
 * PWDRAWER_SCRIM_OPACITY, which carries most of the layer separation.
 */
export const PWDRAWER_SHADOW_OPACITY = 0.06
export const PWDRAWER_SHADOW_ELEVATION = 3

/**
 * Peak tint over the content, at fully open. An order of magnitude lighter than
 * a modal backdrop (0.64): the content should read as slightly shaded by the
 * layer above it, not dimmed out of use. This is the knob to turn if the two
 * layers need more or less separation.
 */
export const PWDRAWER_SCRIM_OPACITY = 0.1

/**
 * The panel contents grow and fade into place as the drawer opens. Keyed off
 * progress rather than run as a separate animation, so a finger-tracked drag
 * passes through the same curve a flick does — the growth follows the thumb
 * instead of firing after the gesture is over.
 *
 * Applied to the contents, not the panel: scaling the panel itself would pull
 * its background out of its own slot and show the layer behind it.
 *
 * Both ramps are sampled quadratic ease-out (`1 - (1 - p)²`) — quick off the
 * mark, decelerating in — rather than composed from `Easing`, which keeps this a
 * plain `interpolate` with no easing function captured into the worklet. They
 * share their progress stops, so the growth and the fade stay locked together.
 */

/**
 * Peaks 2% over full size just before the end, then settles back. The flourish
 * wants to be felt rather than seen; much more than this reads as a bounce.
 */
export const PWDRAWER_CONTENT_SCALE_PROGRESS = [0, 0.25, 0.5, 0.75, 0.88, 1]
export const PWDRAWER_CONTENT_SCALE_VALUES = [0.9, 0.955, 0.985, 1.008, 1.01, 1]

/** No overshoot here — opacity above 1 isn't a value, so it eases in flat. */
export const PWDRAWER_CONTENT_OPACITY_PROGRESS = [0, 0.25, 0.5, 0.75, 1]
export const PWDRAWER_CONTENT_OPACITY_VALUES = [0.2, 0.5, 0.875, 0.97, 1]

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

/** Horizontal travel, in px, before the pan starts following the finger. */
export const PWPAGER_ACTIVATION_OFFSET = 10

/**
 * Vertical travel, in px, that abandons the pan and hands the touch to whatever
 * scrolls inside the page.
 */
export const PWPAGER_VERTICAL_CANCEL_OFFSET = 24

/** Release velocity, px/s, that commits to the next page regardless of travel. */
export const PWPAGER_FLING_VELOCITY = 500

/**
 * Width of the leading strip that reaches the drawer from a page other than the
 * first. Past the first page a mid-screen drag pages backwards instead, so this
 * is the only way to reach the drawer in one gesture from there.
 */
export const PWPAGER_DRAWER_EDGE_WIDTH = 24

export const PWPAGER_SPRING_CONFIG = {
    damping: 40,
    stiffness: 350,
    mass: 1,
    overshootClamping: true,
} as const

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

import { processColor } from 'react-native'
import spinnerAnimation from '@assets/animations/loading-spinner.json'

type SpinnerAnimation = typeof spinnerAnimation

const tinted = new Map<string, SpinnerAnimation>()

// Lottie colours are 0–1 RGBA floats; processColor normalises any RN colour
// string to a 0xAARRGGBB integer on every platform.
const toRgb = (color: string): number[] | null => {
    const argb = processColor(color)
    if (typeof argb !== 'number') return null
    return [
        ((argb >>> 16) & 0xff) / 0xff,
        ((argb >>> 8) & 0xff) / 0xff,
        (argb & 0xff) / 0xff,
    ]
}

// The bundled petals are drawn in black, each keyframe's grey level being how
// far the petal fades toward the opposite end. The light and dark designs are
// exactly that fade from black and from white, so any colour fades the same
// way: toward its inverse by the same amount.
const shade = (rgb: number[], fade: number): number[] => [
    ...rgb.map(channel => channel + (1 - 2 * channel) * fade),
    1,
]

// Baked into the source rather than applied with `colorFilters`, which the
// web renderer ignores and which cannot express the per-keyframe fade.
export const tintSpinner = (color: string): SpinnerAnimation => {
    const cached = tinted.get(color)
    if (cached) return cached
    const rgb = toRgb(color)
    const animation = rgb
        ? {
              ...spinnerAnimation,
              layers: spinnerAnimation.layers.map(layer =>
                  layer.shapes
                      ? {
                            ...layer,
                            shapes: layer.shapes.map(shape =>
                                shape.ty === 'fl' && shape.c
                                    ? {
                                          ...shape,
                                          c: {
                                              ...shape.c,
                                              k: shape.c.k.map(keyframe => ({
                                                  ...keyframe,
                                                  s: shade(rgb, keyframe.s[0]),
                                              })),
                                          },
                                      }
                                    : shape,
                            ),
                        }
                      : layer,
              ),
          }
        : spinnerAnimation
    tinted.set(color, animation as SpinnerAnimation)
    return animation as SpinnerAnimation
}

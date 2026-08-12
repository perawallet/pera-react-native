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

// Test stub for @shopify/react-native-skia. The real package's Platform module
// imports `findNodeHandle` from react-native, which the vitest alias points at
// react-native-web — that export doesn't exist there, so merely importing Skia
// fails collection for every suite whose graph reaches a chart. Drawing
// primitives render nothing; the charts are covered behaviorally instead.

export const Canvas = () => null
export const Circle = () => null
export const DashPathEffect = () => null
export const Group = () => null
export const Line = () => null
export const LinearGradient = () => null
export const Path = () => null
export const Rect = () => null

export const vec = (x: number, y: number) => ({ x, y })

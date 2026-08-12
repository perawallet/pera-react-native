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

// Test stub for victory-native. It renders through Skia, which can't be
// imported under vitest (see skia-stub), and its gestures need a real UI
// thread. Suites that assert on chart wiring mock this module themselves;
// everything else just needs the import to resolve and render nothing.

export const Area = () => null
export const Line = () => null
export const StackedArea = () => null
export const Scatter = () => null
export const Bar = () => null

export const CartesianChart = () => null

export const useChartPressState = () => ({
    state: {
        isActive: { value: false },
        matchedIndex: { value: -1 },
        x: { value: { value: 0 }, position: { value: 0 } },
        y: { value: { value: { value: 0 }, position: { value: 0 } } },
    },
    isActive: false,
})

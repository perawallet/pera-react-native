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

import { ScrollView, ScrollViewProps } from 'react-native'

/**
 * Props for the PWScrollView component.
 */
export type PWScrollViewProps = ScrollViewProps

/**
 * A themed ScrollView component that wraps the standard React Native ScrollView.
 *
 * @example
 * <PWScrollView>
 *   <PWText>Scrollable Content</PWText>
 * </PWScrollView>
 */
export const PWScrollView = (props: PWScrollViewProps) => {
    return <ScrollView {...props} />
}

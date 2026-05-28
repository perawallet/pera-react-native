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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    content: {
        // The header item provides the list's top spacing; keeping the content
        // paddingTop at 0 keeps the sticky-search pin offset aligned with the
        // header height the snap logic measures.
        paddingTop: 0,
    },
    // The search row is a sticky header. Its input pill is the only painted
    // surface, so without an opaque backing the list rows scroll *through* the
    // transparent space around the pill — most visible during iOS top
    // overscroll, where it reads as the sticky bar losing its margin. An opaque
    // backing matching the list background occludes the rows behind it.
    searchSticky: {
        backgroundColor: theme.colors.background,
    },
}))

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
    rootContainer: {
        flex: 1,
        flexDirection: 'column',
    },
    imageContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        position: 'absolute',
        top: 0,
        right: 0,

    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.xl,
    },
    headerTitle: {
        fontWeight: '600',
        paddingLeft: theme.spacing.xl,
        alignSelf: 'flex-end',
    },
    headerImage: {
        width: 137,
        height: 217,
        resizeMode: 'contain'
    },
    scrollContent: {
        paddingBottom: theme.spacing['3xl'],
    },
    mainContainer: {
        paddingHorizontal: theme.spacing.xl,
        flexDirection: 'column',
        gap: theme.spacing.md,
    },
}))

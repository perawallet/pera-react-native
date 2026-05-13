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
    container: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        top: theme.spacing.md,
        left: theme.spacing.md,
        zIndex: 1,
    },
    heroImage: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    scrollContent: {
        flex: 1,
    },
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
    },
    title: {
        marginVertical: theme.spacing.xl,
    },
    paragraph: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xl,
    },
    footer: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
    },
}))

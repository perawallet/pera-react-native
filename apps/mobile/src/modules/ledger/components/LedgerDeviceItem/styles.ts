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

import { makeStyles } from '@rneui/themed'

const ICON_CONTAINER_SIZE = 40

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        marginHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.md,
        // Card elevation sits between theme.shadows.sm and .md. Reuse sm's
        // color/offset/radius and bump opacity/elevation to match design.
        // Promote to a `card` shadow token if a third instance shows up.
        ...theme.shadows.sm,
        shadowOpacity: 0.08,
        elevation: 3,
    },
    iconContainer: {
        width: ICON_CONTAINER_SIZE,
        height: ICON_CONTAINER_SIZE,
        borderRadius: ICON_CONTAINER_SIZE / 2,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    deviceName: {
        color: theme.colors.textMain,
    },
    transportBadge: {
        marginRight: theme.spacing.sm,
    },
}))

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

import { PWView } from '@components/core'
import { AssetSecurityTag } from '../AssetSecurityTag'
import { useAssetSecurityTags } from './useAssetSecurityTags'
import { useStyles } from './styles'

export type AssetSecurityTagsProps = {
    assetId: string
}

export const AssetSecurityTags = ({ assetId }: AssetSecurityTagsProps) => {
    const styles = useStyles()
    const { isVisible, freezeTag, clawbackTag } = useAssetSecurityTags(assetId)

    if (!isVisible) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <AssetSecurityTag {...freezeTag} />
            <AssetSecurityTag {...clawbackTag} />
        </PWView>
    )
}

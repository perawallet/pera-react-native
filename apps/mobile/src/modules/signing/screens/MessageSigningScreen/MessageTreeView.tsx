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

import type { MessageTreeNode } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

type MessageTreeViewProps = {
    nodes: MessageTreeNode[]
}

export const MessageTreeView = ({ nodes }: MessageTreeViewProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.treeNode}>
            {nodes.map((node, index) => (
                <PWView
                    key={`${node.label}-${index}`}
                    style={styles.treeNode}
                >
                    <PWText variant='captionMedium'>{node.label}</PWText>
                    {'children' in node ? (
                        <PWView style={styles.treeChildren}>
                            <MessageTreeView nodes={node.children} />
                        </PWView>
                    ) : (
                        <PWText variant='mono'>{node.value}</PWText>
                    )}
                </PWView>
            ))}
        </PWView>
    )
}

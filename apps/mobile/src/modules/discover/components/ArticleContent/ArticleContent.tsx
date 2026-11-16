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

import { Fragment, type ReactNode } from 'react'
import { PWText, PWView } from '@components/core'
import type { FontWeight, TypographyVariant } from '@theme/typography'
import {
    toArticleLinkUrl,
    type ArticleBlock,
    type ArticleInline,
} from '../../utils/articleHtml'
import { ARTICLE_BOLD, articleRunStyle } from '../../utils/articleRunStyle'
import { ArticleImage } from './ArticleImage'
import { useStyles } from './styles'

export type ArticleContentProps = {
    blocks: ArticleBlock[]
    /** Called with a link's href; only links `toArticleLinkUrl` accepts are pressable. */
    onLinkPress: (href: string) => void
    testID?: string
}

const HTTPS_SRC = /^https:\/\//i

type HeadingLook = { variant: TypographyVariant; weight?: FontWeight }

const BODY_LOOK: HeadingLook = { variant: 'body' }

// h4 is weight 600, which draws regular on iOS (see ARTICLE_BOLD), so the
// smaller headings set bold themselves; h4 and below step down to body size.
const HEADING_LOOK: Record<1 | 2 | 3 | 4 | 5 | 6, HeadingLook> = {
    1: { variant: 'h2' },
    2: { variant: 'h3' },
    3: { variant: 'h4', weight: ARTICLE_BOLD },
    4: { variant: 'body', weight: ARTICLE_BOLD },
    5: { variant: 'body', weight: ARTICLE_BOLD },
    6: { variant: 'body', weight: ARTICLE_BOLD },
}

export const ArticleContent = ({
    blocks,
    onLinkPress,
    testID,
}: ArticleContentProps) => {
    const styles = useStyles()

    // Each run inherits from the Text around it (block or link), see articleRunStyle.
    const renderInline = (
        pieces: ArticleInline[],
        base: HeadingLook,
        inLink: boolean,
    ): ReactNode =>
        pieces.map((piece, index) => {
            if (piece.type === 'break') return '\n'
            if (piece.type === 'link') {
                if (toArticleLinkUrl(piece.href) === null) {
                    return (
                        <Fragment key={index}>
                            {renderInline(piece.children, base, inLink)}
                        </Fragment>
                    )
                }
                return (
                    <PWText
                        key={index}
                        variant={base.variant}
                        weight={base.weight}
                        style={styles.link}
                        onPress={() => onLinkPress(piece.href)}
                        testID='discover_news_article_link'
                    >
                        {renderInline(piece.children, base, true)}
                    </PWText>
                )
            }
            const look = articleRunStyle(
                piece,
                base.variant,
                inLink,
                base.weight,
            )
            if (look.plain) {
                return <Fragment key={index}>{piece.value}</Fragment>
            }
            return (
                <PWText
                    key={index}
                    variant={look.variant}
                    weight={look.weight}
                    style={[
                        look.italic && styles.italic,
                        look.link && styles.link,
                    ]}
                >
                    {piece.value}
                </PWText>
            )
        })

    const renderBlocks = (items: ArticleBlock[]): ReactNode =>
        items.map((block, index) => {
            switch (block.type) {
                case 'heading': {
                    const heading = HEADING_LOOK[block.level]
                    return (
                        <PWText
                            key={index}
                            variant={heading.variant}
                            weight={heading.weight}
                        >
                            {renderInline(block.children, heading, false)}
                        </PWText>
                    )
                }
                case 'paragraph': {
                    return (
                        <PWText key={index}>
                            {renderInline(block.children, BODY_LOOK, false)}
                        </PWText>
                    )
                }
                case 'list': {
                    return (
                        <PWView
                            key={index}
                            style={styles.list}
                        >
                            {block.items.map((item, itemIndex) => (
                                <PWView
                                    key={itemIndex}
                                    style={styles.listItem}
                                >
                                    <PWText style={styles.listMarker}>
                                        {block.ordered
                                            ? `${block.start + itemIndex}.`
                                            : '•'}
                                    </PWText>
                                    <PWView style={styles.listBody}>
                                        {renderBlocks(item)}
                                    </PWView>
                                </PWView>
                            ))}
                        </PWView>
                    )
                }
                case 'image': {
                    return HTTPS_SRC.test(block.src) ? (
                        // Keyed by src too, so a refetched article's new image
                        // does not inherit another image's failed or size state.
                        <ArticleImage
                            key={`${index}:${block.src}`}
                            src={block.src}
                        />
                    ) : null
                }
                case 'quote': {
                    return (
                        <PWView
                            key={index}
                            style={styles.quote}
                        >
                            {renderBlocks(block.children)}
                        </PWView>
                    )
                }
                case 'code': {
                    return (
                        <PWView
                            key={index}
                            style={styles.code}
                        >
                            <PWText variant='mono'>{block.text}</PWText>
                        </PWView>
                    )
                }
                case 'rule': {
                    return (
                        <PWView
                            key={index}
                            style={styles.rule}
                        />
                    )
                }
            }
        })

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            {renderBlocks(blocks)}
        </PWView>
    )
}

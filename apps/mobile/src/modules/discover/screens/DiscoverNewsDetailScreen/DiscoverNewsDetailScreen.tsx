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

import {
  PWButton,
  PWImage,
  PWScreen,
  PWScrollView,
  PWSkeleton,
  PWText,
  PWView,
} from "@components/core";
import { EmptyView } from "@components/EmptyView";
import { useLanguage } from "@hooks/useLanguage";
import { ArticleContent } from "../../components/ArticleContent";
import { useDiscoverNewsDetailScreen } from "./useDiscoverNewsDetailScreen";
import { useStyles } from "./styles";

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: date placeholder width, as the web skeleton
const DATE_SKELETON_WIDTH = 102;
// lanekeep-ignore-next-line pera/no-numeric-sizes reason: title placeholder height, as the web skeleton
const TITLE_SKELETON_HEIGHT = 60;
// lanekeep-ignore-next-line pera/no-numeric-sizes reason: banner placeholder height, as the web skeleton
const BANNER_SKELETON_HEIGHT = 180;

export const DiscoverNewsDetailScreen = () => {
  const styles = useStyles();
  const { t } = useLanguage();
  const screen = useDiscoverNewsDetailScreen();

  const renderBody = () => {
    if (screen.isLoading) {
      return (
        <PWView style={styles.content} testID="discover_news_detail_loading">
          <PWSkeleton
            width={DATE_SKELETON_WIDTH}
            height={DATE_SKELETON_WIDTH / 4}
          />
          <PWSkeleton height={TITLE_SKELETON_HEIGHT} />
          <PWSkeleton height={BANNER_SKELETON_HEIGHT} />
        </PWView>
      );
    }
    if (screen.isError) {
      return (
        <EmptyView
          body={t("discover.news.load_failure")}
          style={styles.error}
          testID="discover_news_detail_error"
          button={
            <PWButton
              variant="secondary"
              title={t("common.retry.label")}
              onPress={screen.retry}
              testID="discover_news_detail_retry"
            />
          }
        />
      );
    }
    return (
      <PWView style={styles.content}>
        <PWText variant="captionMedium" style={styles.date}>
          {screen.dateDisplay}
        </PWText>
        <PWText variant="h2" testID="discover_news_detail_title">
          {screen.title}
        </PWText>
        {screen.banner ? (
          <PWImage source={{ uri: screen.banner }} style={styles.banner} />
        ) : null}
        <ArticleContent
          blocks={screen.blocks}
          onLinkPress={screen.openLink}
          testID="discover_news_article"
        />
      </PWView>
    );
  };

  return (
    <PWScreen scroll="never" testID="discover_news_detail_screen">
      <PWScrollView>{renderBody()}</PWScrollView>
    </PWScreen>
  );
};

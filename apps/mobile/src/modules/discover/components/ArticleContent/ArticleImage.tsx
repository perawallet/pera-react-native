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

import { useState } from "react";
import { PWImage } from "@components/core";
import { useStyles } from "./styles";

export type ArticleImageProps = {
  src: string;
};

// Wide enough for most article images until the real size is known.
const DEFAULT_IMAGE_ASPECT = 16 / 9;
// A portrait image is boxed at 3:4 and letterboxed, so it never fills screens of scrolling.
const MIN_IMAGE_ASPECT = 3 / 4;

/** An article image at full width, at its own aspect once it has loaded. */
export const ArticleImage = ({ src }: ArticleImageProps) => {
  const styles = useStyles();
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_IMAGE_ASPECT);
  // An image that cannot load takes no room, rather than leaving a blank box.
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) return null;

  return (
    <PWImage
      source={{ uri: src }}
      resizeMode="contain"
      style={[styles.image, { aspectRatio }]}
      onError={() => setHasFailed(true)}
      onLoad={(event) => {
        const { width, height } = event.source;
        if (width > 0 && height > 0)
          setAspectRatio(Math.max(width / height, MIN_IMAGE_ASPECT));
      }}
    />
  );
};

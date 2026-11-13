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

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverEvent, trackEvent } from "@analytics";
import { useAppNavigation } from "@hooks/useAppNavigation";
import { useOpenNewsItem } from "../useOpenNewsItem";

vi.mock("@analytics", async () => ({
  ...(await vi.importActual<object>("@analytics")),
  trackEvent: vi.fn(),
}));
vi.mock("@hooks/useAppNavigation", () => ({ useAppNavigation: vi.fn() }));

const navigate = vi.fn();

describe("useOpenNewsItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppNavigation).mockReturnValue({ navigate } as never);
  });

  it("tracks the tap with the title and opens the native detail", () => {
    // Arrange
    const { result } = renderHook(() => useOpenNewsItem());

    // Act
    result.current({ id: "7", title: "Hello" });

    // Assert
    expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.NewsOpenTap, {
      news_title: "Hello",
    });
    expect(navigate).toHaveBeenCalledWith("DiscoverNewsDetail", {
      newsId: "7",
    });
  });
});

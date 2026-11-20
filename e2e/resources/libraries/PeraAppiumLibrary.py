"""AppiumLibrary plus a `tid=<testID>` locator, one spelling for a React Native testID on both platforms.

On Android XPath makes the device serialize and re-parse the whole view tree on every lookup, so
`tid=` walks the live accessibility tree instead. iOS keeps XPath on purpose (see below).
"""

from datetime import timedelta
from time import sleep

from AppiumLibrary import AppiumLibrary
from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import StaleElementReferenceException


class PeraAppiumLibrary(AppiumLibrary):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._element_finder._strategies["tid"] = self._find_by_test_id

    def wait_until_element_settles(self, locator):
        """Wait for the same rectangle across four samples, then confirm that the locator still matches."""
        element = None

        def find_first_match():
            nonlocal element
            element = self._element_find(locator, first_only=True, required=False)
            return element is not None

        self._wait_until(15, f"Element '{locator}' did not appear in <TIMEOUT>", find_first_match)
        previous, stable = None, 0
        for sample in range(31):
            if sample:
                sleep(0.15)
            if element is None and not find_first_match():
                continue
            try:
                bounds = element.rect
            except StaleElementReferenceException:
                element, previous, stable = None, None, 0
                continue
            stable = stable + 1 if bounds == previous else 0
            previous = bounds
            if stable == 3:
                settled = element
                # A replacement can shadow a still-live element in the accessibility tree. A driver
                # may also mint a fresh id per lookup, so the same rectangle counts as the same view.
                if find_first_match():
                    try:
                        if element.id == settled.id or element.rect == bounds:
                            return
                    except StaleElementReferenceException:
                        element = None
                previous, stable = None, 0
        raise AssertionError(f"{locator} did not stop moving or resizing.")

    def text_under(self, locator):
        """The text a container renders, joined in screen order without repeats.

        Reading a container directly gives back an empty string on Android, so its text nodes are
        read instead. React Native can also mount a testID'd card as an empty view with its content
        as siblings, so a container with no text below it falls back to the text nodes drawn inside
        its rectangle.
        """
        container = self._element_find(locator, first_only=True, required=True)
        texts = "//*[string-length(@text) > 0 or string-length(@label) > 0 or string-length(@name) > 0]"
        nodes = container.find_elements(AppiumBy.XPATH, "." + texts)
        if not nodes:
            box = container.rect
            nodes = [
                node
                for node in self._current_application().find_elements(AppiumBy.XPATH, texts)
                if _inside(node.rect, box)
            ]
        parts = []
        for node in nodes:
            text = node.text
            if text and text not in parts:
                parts.append(text)
        return " ".join(parts)

    def get_clipboard_text(self):
        """The device clipboard as text, for values a screen shows only shortened."""
        return self._current_application().get_clipboard_text()

    def _retry_assertion(self, assert_func, timeout=timedelta(seconds=5), retry_interval=timedelta(seconds=1)):
        # AppiumLibrary 3.2.1 skips its loop at zero and raises None instead of checking once.
        if timeout.total_seconds() == 0:
            return assert_func()
        return super()._retry_assertion(assert_func, timeout, retry_interval)

    def _find_by_test_id(self, application, criteria, tag, constraints):
        # The id goes into a selector string unescaped; name the bad id instead of a selector error.
        if any(c in criteria for c in "'\"\\"):
            raise ValueError(f"tid= cannot contain quotes or backslashes: {criteria}")
        if application.capabilities.get("platformName", "").lower() == "android":
            # testID is the bare resource-id, which `id=` never matches: UiAutomator2 prefixes it
            # with the package. content-desc covers views that carry the ID as their label. Both
            # selectors only work through find_elements; find_element reads the first one alone.
            by = AppiumBy.ANDROID_UIAUTOMATOR
            value = (
                f'new UiSelector().resourceId("{criteria}");'
                f'new UiSelector().description("{criteria}")'
            )
        else:
            # WDA's XPath is its only lookup that first waits for animations to finish (up to its
            # animationCoolOffTimeout); the session turns off XCUITest's other idle waits, so this
            # is what keeps a lookup right after a transition from seeing the screen mid-animation.
            by, value = AppiumBy.XPATH, f"//*[@name='{criteria}']"
        return self._element_finder._filter_elements(
            application.find_elements(by=by, value=value), tag, constraints
        )


def _inside(inner, outer):
    return (
        inner["x"] >= outer["x"]
        and inner["y"] >= outer["y"]
        and inner["x"] + inner["width"] <= outer["x"] + outer["width"]
        and inner["y"] + inner["height"] <= outer["y"] + outer["height"]
    )

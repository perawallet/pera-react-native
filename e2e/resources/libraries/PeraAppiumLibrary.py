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
                # A replacement can shadow a still-live element in the accessibility tree.
                if find_first_match() and element.id == settled.id:
                    return
                previous, stable = None, 0
        raise AssertionError(f"{locator} did not stop moving or resizing.")

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

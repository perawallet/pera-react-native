"""AppiumLibrary plus a `tid=<testID>` locator, one spelling for a React Native testID on both platforms.

On Android XPath makes the device serialize and re-parse the whole view tree on every lookup, so
`tid=` walks the live accessibility tree instead. iOS keeps XPath on purpose (see below).
"""

from AppiumLibrary import AppiumLibrary
from appium.webdriver.common.appiumby import AppiumBy


class PeraAppiumLibrary(AppiumLibrary):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._element_finder._strategies["tid"] = self._find_by_test_id

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

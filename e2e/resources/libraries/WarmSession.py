"""Close the shared Appium session when the enclosing warm job finishes, even on failure."""

from robot.api import logger
from robot.libraries.BuiltIn import BuiltIn


class WarmSession:
    ROBOT_LISTENER_API_VERSION = 3

    def __init__(self, library_name='AppiumLibrary'):
        self.appium = None
        self.library_name = library_name

    def start_test(self, data, result):
        try:
            self.appium = BuiltIn().get_library_instance(self.library_name)
        except Exception as error:
            # Without the library the session is never closed and holds a parallel slot until it idles out.
            logger.warn(f'WarmSession cannot reach {self.library_name}: {error}')

    def end_suite(self, data, result):
        # A failed child must not lend a potentially broken session to the next suite.
        if self.appium is not None and (data.parent is None or result.failed):
            self.appium.close_all_applications()

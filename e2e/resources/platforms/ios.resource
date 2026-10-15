*** Settings ***
Documentation       iOS adapter; see android.resource.
Library             AppiumLibrary    run_on_failure=Nothing
Library             Collections
Library             Process


*** Variables ***
${APPIUM_URL}           http://127.0.0.1:4723
${IOS_BUNDLE_ID}        com.algorandllc.perarn.staging
${IOS_UDID}             ${EMPTY}
# One WebDriverAgent port per simulator when several run in parallel.
${IOS_WDA_PORT}         8100
# A dev client's own link to its Metro server, e.g. exp+pera-dev://expo-development-client/?url=...
# Set it for dev-client runs: a plain relaunch can land on the launcher instead of the app.
${IOS_DEV_CLIENT_URL}   ${EMPTY}
${MENU_TAB}             accessibility_id=tab_menu_button


*** Keywords ***
Open Pera
    &{caps}=    Create Dictionary
    ...    platformName=iOS
    ...    automationName=XCUITest
    ...    bundleId=${IOS_BUNDLE_ID}
    ...    noReset=${True}
    # isHeadless: without it the driver reboots a DeviceHub simulator and opens a new window per
    # session. autoLaunch=false attaches to the running app, so a dev client keeps its Metro URL.
    ...    isHeadless=${True}
    ...    autoLaunch=${False}
    ...    autoAcceptAlerts=${True}
    # Skip XCUITest's settle-before-every-action waits; tests wait on their own anchors.
    ...    waitForQuiescence=${False}
    ...    waitForIdleTimeout=${0}
    ...    reduceMotion=${True}
    ...    wdaLocalPort=${{int($IOS_WDA_PORT)}}
    IF    $IOS_UDID    Set To Dictionary    ${caps}    udid=${IOS_UDID}
    IF    $IOS_UDID    Hide Dev Menu Button
    Open Application    ${APPIUM_URL}    &{caps}

Hide Dev Menu Button
    # A dev client's floating menu button is a window above the app that steals header taps.
    # Simulator only; a release build has none.
    Run Process    xcrun    simctl    spawn    ${IOS_UDID}    defaults    write    ${IOS_BUNDLE_ID}
    ...    EXDevMenuShowFloatingActionButton    -bool    false

Dismiss Dev Client Intro
    # First launch of a dev client opens its developer menu over the app; Continue leaves the menu up.
    ${intro}=    Run Keyword And Return Status
    ...    Page Should Contain Element    xpath=//XCUIElementTypeButton[@name='Continue']
    IF    not ${intro}    RETURN
    Click Element    xpath=//XCUIElementTypeButton[@name='Continue']
    Close Sheet

Restart Pera
    Terminate Application    ${IOS_BUNDLE_ID}
    IF    $IOS_DEV_CLIENT_URL
        Open Deeplink    ${IOS_DEV_CLIENT_URL}
    ELSE
        Activate Application    ${IOS_BUNDLE_ID}
    END

Open Deeplink
    [Arguments]    ${url}
    Execute Script    mobile: deepLink    url=${url}    bundleId=${IOS_BUNDLE_ID}
    # Newer runtimes confirm a custom-scheme link with an "Open in" SpringBoard alert.
    Run Keyword And Ignore Error    Execute Script    mobile: alert    action=accept    buttonLabel=Open

Dismiss Keyboard
    # Header taps work with the keyboard up on iOS, and Hide Keyboard costs ~3s failing there.
    No Operation

Close Sheet
    # Modal sheets hide the drag handle and their scroll view swallows swipes; tap the backdrop above.
    ${w}=    Get Window Width
    ${h}=    Get Window Height
    Execute Script    mobile: tap    x=${{int(${w} * 0.5)}}    y=${{int(${h} * 0.08)}}

*** Settings ***
Documentation       Remote-config flags default to whatever the backend serves, and several features
...                 ship off. E2E builds carry Debug Tools, whose Feature Flags screen overrides a flag
...                 on the device until the app's stores are cleared, so a suite can reach a gated
...                 feature on any backend.
Resource            app.resource


*** Variables ***
${SETTINGS_DEVELOPER_ROW}           tid=settings_item_developer_settings
${SETTINGS_APP_VERSION}             tid=settings_app_version
# The toast carries no testID; matched on settings.developer.debug_tools_enabled (English). iOS keeps
# a dismissed toast in the tree off-screen with visible=false.
${DEBUG_TOOLS_ENABLED_TOAST}        xpath=//*[(@text='Debug tools enabled' or @label='Debug tools enabled') and not(@visible='false')]
${DEBUG_TOOLS_ROW}                  tid=developer_settings_debug_tools_item
${FEATURE_FLAGS_ROW}                tid=debug_tools_feature_flags_item


*** Keywords ***
Turn On Feature Flag
    [Documentation]    Settings -> Developer -> Debug Tools -> Feature Flags, then the flag's override on.
    ...                Expanding a flag creates its override switched off, and a second tap on the expand
    ...                switch removes it again, so each switch is tapped only when it is not yet where
    ...                it should be. Leaves the app on the Feature Flags screen.
    [Arguments]    ${flag}
    Open Settings
    Unlock Debug Tools
    Swipe Until In View    ${SETTINGS_DEVELOPER_ROW}
    Tap    ${SETTINGS_DEVELOPER_ROW}
    Swipe Until In View    ${DEBUG_TOOLS_ROW}
    Tap    ${DEBUG_TOOLS_ROW}
    # Debug Tools is still sliding in when its rows appear; a tap then misses the row.
    Wait Until Settled    ${FEATURE_FLAGS_ROW}
    Tap    ${FEATURE_FLAGS_ROW}
    Scroll Into View    feature_flag_expand_${flag}
    ${overridden}=    Run Keyword And Return Status    Page Should Contain Element    tid=feature_flag_override_${flag}
    IF    not ${overridden}    Tap    tid=feature_flag_expand_${flag}
    Scroll Into View    feature_flag_override_${flag}
    ${on}=    Switch Is On    tid=feature_flag_override_${flag}
    IF    not ${on}    Tap    tid=feature_flag_override_${flag}
    Switch Should Be    tid=feature_flag_override_${flag}    ${True}

Unlock Debug Tools
    [Documentation]    Ten taps on the version row, each within 1s of the last (AppVersion.tsx resets the
    ...                count on a longer gap). Re-locating the element per tap can exceed that on a
    ...                loaded device, so the point is resolved once and tapped by coordinate.
    # The footer stays in the lower quarter even scrolled to the end, which Swipe Until In View refuses.
    Scroll Into View    settings_app_version
    ${loc}=    Get Element Location    ${SETTINGS_APP_VERSION}
    ${size}=    Get Element Size    ${SETTINGS_APP_VERSION}
    VAR    @{point}    ${{int($loc['x'] + $size['width'] / 2)}}    ${{int($loc['y'] + $size['height'] / 2)}}
    AppiumLibrary.Tap    ${point}    count=10    duration=0.05s
    # The success toast proves the unlock, and while up it swallows taps on the top row of the next
    # screens (Feature Flags on Debug Tools).
    Wait Until Page Contains Element    ${DEBUG_TOOLS_ENABLED_TOAST}    timeout=5s
    Wait Until Page Does Not Contain Element    ${DEBUG_TOOLS_ENABLED_TOAST}    timeout=10s

Swipe Until In View
    [Documentation]    Swipes until the element sits in the upper three quarters of the window, clear of
    ...                sticky footers. Android leaves off-screen rows out of the tree; iOS keeps them
    ...                with an off-screen position, which also says which way to scroll.
    [Arguments]    ${locator}
    ${h}=    Get Window Height
    VAR    ${last_y}    ${None}
    FOR    ${i}    IN RANGE    8
        ${present}=    Run Keyword And Return Status    Page Should Contain Element    ${locator}
        IF    ${present}
            ${loc}=    Get Element Location    ${locator}
            IF    0 < ${loc}[y] < ${h} * 0.75    RETURN
            # A screen that fits never scrolls the row up; a swipe that left it in place proves that.
            IF    $last_y == ${loc}[y] and ${loc}[y] < ${h} * 0.9    RETURN
            VAR    ${last_y}    ${loc}[y]
            IF    ${loc}[y] <= 0
                Swipe By Percent    50    35    50    70    duration=0.4s
                CONTINUE
            END
        END
        Swipe By Percent    50    70    50    35    duration=0.4s
    END
    Fail    ${locator} never scrolled into view.

Set Feature Flag Text
    [Documentation]    A string-valued flag's override, typed on the Feature Flags screen that
    ...                Turn On Feature Flag leaves open. An empty value removes the override.
    [Arguments]    ${flag}    ${value}
    Scroll Into View    feature_flag_string_input_${flag}
    Clear Text    tid=feature_flag_string_input_${flag}
    IF    $value    Input Text    tid=feature_flag_string_input_${flag}    ${value}
    Dismiss Keyboard

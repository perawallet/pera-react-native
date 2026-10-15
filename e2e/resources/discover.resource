*** Settings ***
Documentation       Discover is a full-screen WebView of a remote site behind the shared age gate. Only
...                 the native shell is asserted; in-page content would need a webview context.
Resource            app.resource


*** Variables ***
# Tabs other than Menu have no testID; both platforms expose the visible label.
${DISCOVER_TAB}             accessibility_id=Discover
${HOME_TAB}                 accessibility_id=Home
${MORE_BUTTON}              accessibility_id=more_button
# The declaration's buttons have no testID (ConfirmActionContent takes no confirmTestID here).
${AGE_GATE_CONFIRM}         xpath=//*[@text='I am 18 or older' or @label='I am 18 or older']
${AGE_GATE_RETRY}           accessibility_id=age-gate-retry
${WEBVIEW_OFFLINE}          accessibility_id=pw-webview-offline
${WEBVIEW_TIMEOUT}          accessibility_id=pw-webview-timeout


*** Keywords ***
Open Past Age Gate
    [Documentation]    Taps ${entry} and accepts the age declaration if it shows, until ${destination}
    ...                is up. A late first-run prompt can swallow the first tap, so the entry is
    ...                tapped again while it is still on screen.
    [Arguments]    ${entry}    ${destination}    ${also_dismiss}=${NONE}
    Wait Until Page Contains Element    ${entry}    timeout=30s
    Tap    ${entry}
    FOR    ${i}    IN RANGE    60
        ${there}=    Run Keyword And Return Status    Page Should Contain Element    ${destination}
        IF    ${there}    RETURN
        Tap If Present    ${AGE_GATE_CONFIRM}
        IF    $also_dismiss    Tap If Present    ${also_dismiss}
        IF    ${i} % 10 == 9    Tap If Present    ${entry}
        Sleep    0.5s
    END
    Fail    ${destination} did not appear after opening ${entry}.

Open Discover
    Open Past Age Gate    ${DISCOVER_TAB}    ${WEBVIEW}

Discover Page Should Be Loaded
    Wait Until Page Contains Element    ${WEBVIEW}    timeout=60s
    Page Should Not Contain Element    ${AGE_GATE_RETRY}
    Page Should Not Contain Element    ${WEBVIEW_OFFLINE}
    Page Should Not Contain Element    ${WEBVIEW_TIMEOUT}

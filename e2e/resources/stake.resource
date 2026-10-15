*** Settings ***
Documentation       Staking: Menu -> Staking behind the shared age gate. Projects come from remote
...                 config, and opening one pushes its site in the in-app browser after a one-time
...                 disclaimer that unlocks only once scrolled to the end.
Resource            discover.resource


*** Variables ***
${MENU_STAKING_BUTTON}          accessibility_id=menu_staking_button
${STAKING_SUBTITLE}             accessibility_id=staking-subtitle
${STAKING_HELP_BUTTON}          accessibility_id=staking-help-button
${STAKING_HELP_TITLE}           accessibility_id=staking-help-sheet-title
${STAKING_ERROR_TITLE}          accessibility_id=staking-error-title
# Card ids come from remote config, so match the prefix on either platform's id attribute.
${STAKING_FIRST_CARD}           xpath=(//*[starts-with(@content-desc,'staking-project-card-') or starts-with(@name,'staking-project-card-')])[1]
${STAKING_DISCLAIMER_TITLE}     accessibility_id=staking-disclaimer-title
${STAKING_DISCLAIMER_ACCEPT}    accessibility_id=staking-disclaimer-accept-button
${WEBVIEW_CLOSE_BUTTON}         accessibility_id=webview_close_button


*** Keywords ***
Open Staking
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
    Tap    ${MENU_TAB}
    Open Past Age Gate    ${MENU_STAKING_BUTTON}    ${STAKING_SUBTITLE}

Staking Projects Should Be Listed
    [Documentation]    Projects come from remote config; an empty or failed fetch is an environment
    ...                gap, not an app regression, so the case is skipped rather than failed.
    ${listed}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${STAKING_FIRST_CARD}    timeout=30s
    Skip If    not ${listed}    No staking projects loaded (remote config empty or unreachable).

Tap First Project
    [Documentation]    Returns whether the disclaimer showed rather than the project opening directly.
    Tap    ${STAKING_FIRST_CARD}
    FOR    ${i}    IN RANGE    40
        ${disclaimer}=    Run Keyword And Return Status    Page Should Contain Element    ${STAKING_DISCLAIMER_TITLE}
        IF    ${disclaimer}    RETURN    ${True}
        ${project}=    Run Keyword And Return Status    Page Should Contain Element    ${WEBVIEW_CLOSE_BUTTON}
        IF    ${project}    RETURN    ${False}
        Sleep    0.5s
    END
    Fail    Tapping a project opened neither the disclaimer nor the project page.

Scroll Disclaimer To The End
    Wait Until Settled    ${STAKING_DISCLAIMER_TITLE}
    FOR    ${i}    IN RANGE    6
        ${enabled}=    Run Keyword And Return Status    Element Should Be Enabled    ${STAKING_DISCLAIMER_ACCEPT}
        IF    ${enabled}    RETURN
        Swipe By Percent    50    80    50    25    duration=400ms
    END
    Element Should Be Enabled    ${STAKING_DISCLAIMER_ACCEPT}

Close Disclaimer
    [Documentation]    Scrolled to the end, a downward swipe can scroll the text back instead of
    ...                closing the sheet, so close until the title is gone.
    FOR    ${i}    IN RANGE    3
        Close Sheet
        ${open}=    Run Keyword And Return Status    Page Should Contain Element    ${STAKING_DISCLAIMER_TITLE}
        IF    not ${open}    RETURN
    END
    Page Should Not Contain Element    ${STAKING_DISCLAIMER_TITLE}

Accept Disclaimer
    Scroll Disclaimer To The End
    Tap    ${STAKING_DISCLAIMER_ACCEPT}

Project Page Should Be Open
    Wait Until Page Contains Element    ${WEBVIEW_CLOSE_BUTTON}    timeout=30s

Close Project Page
    Tap    ${WEBVIEW_CLOSE_BUTTON}
    Wait Until Page Contains Element    ${STAKING_SUBTITLE}    timeout=15s

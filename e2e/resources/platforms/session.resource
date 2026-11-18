*** Settings ***
Documentation       Shared Appium session startup for Android and iOS.
Library             OperatingSystem


*** Variables ***
${E2E_LOCAL_RUN}     ${False}


*** Keywords ***
Open Appium Session
    [Arguments]    ${remote_url}    &{caps}
    IF    not ${E2E_LOCAL_RUN}
        Open Application    ${remote_url}    &{caps}
        RETURN
    END
    TRY
        Open Application    ${remote_url}    &{caps}
    EXCEPT    AS    ${error}
        Create File    ${OUTPUT DIR}/.incomplete    ${error}
        Fatal Error
        ...    Could not open the local ${caps.platformName} Appium session. See the Appium log and ${OUTPUT DIR}/.incomplete.
    END

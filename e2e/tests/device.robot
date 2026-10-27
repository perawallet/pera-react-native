*** Settings ***
Documentation       Native capabilities and platform behaviour. Each case restores the device state it
...                 changes (permission, connectivity, PIN) in its own teardown.
Resource            ../resources/device.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Tags           device


*** Test Cases ***
Denied Camera Shows The Scanner's Permission State
    [Tags]    id:device.camera.denied    p1
    Deny Camera Permission
    Relaunch Pera
    Go Home
    Tap    ${QR_SCANNER_BUTTON}
    Wait Until Page Contains Element    ${CAMERA_DENIED_TITLE}    timeout=15s
    Dismiss Camera Denied Sheet
    # Closing the permission sheet leaves the scanner screen itself open, which is
    # capture-protected - the screenshot at this failure was solid black, not a missing Home.
    # The assertion is that the flow gets back to Home, so leave the scanner too.
    Leave Scanner To Home
    [Teardown]    Restore Camera Permission

Passphrase Screen Is Capture Protected
    [Tags]    id:device.capture-protection.passphrase    p0
    Screen Should Not Be Capture Protected
    Open Passphrase
    Screen Should Be Capture Protected
    Go Home
    Screen Should Not Be Capture Protected

Losing The Network Shows Offline Mode Until It Returns
    [Tags]    id:device.network.offline-banner    p1
    Set Network Offline
    Wait Until Page Contains Element    ${OFFLINE_BANNER}    timeout=30s
    Set Network Online
    Wait Until Page Does Not Contain Element    ${OFFLINE_BANNER}    timeout=60s
    [Teardown]    Restore Network

Biometric Unlock Opens The Locked App
    [Tags]    id:device.biometrics.unlock    p1
    [Setup]    Start On Security
    Require Regular Pin
    Require Biometric Switch
    Tap    ${BIOMETRIC_TOGGLE}
    Wait Until Keyword Succeeds    20s    2s    Biometric Match Should Turn Switch On
    Restart Pera
    Wait Until Keyword Succeeds    30s    2s    Biometric Match Should Unlock
    [Teardown]    Turn Biometrics And Pin Off

*** Settings ***
Documentation       Ethereum on a device, in the nightly pool. Both cases need a staging E2E build that
...                 ships Ethereum; the send case also needs a funded Sepolia wallet and skips without
...                 one. See e2e/README.md, "Ethereum".
Resource            ../resources/ethereum.resource

Suite Setup         Open Pera
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           ethereum


*** Test Cases ***
Imported Seed Derives The Test Vector Ethereum Address
    [Tags]    id:ethereum.import.address    p0
    Import Ethereum Test Vector
    ${address}=    Ethereum Address Of Selected Account
    Should Be Equal As Strings    ${address}    ${ETHEREUM_VECTOR_ADDRESS}    ignore_case=True
    ...    msg=The imported seed derived ${address} on Ethereum; the test vector says ${ETHEREUM_VECTOR_ADDRESS}.

Ethereum Send Reaches History On Sepolia
    [Documentation]    Sends to its own address, so a run spends only gas.
    # p1 keeps it out of the critical profile: a public Sepolia RPC stall would turn that red.
    [Tags]    id:ethereum.send.sepolia    p1
    # An import, a Sepolia block and the History reconciler poll outlast the default five minutes.
    [Timeout]    10 minutes
    [Teardown]    Leave Sepolia
    Import Funded Ethereum Wallet
    ${address}=    Ethereum Address Of Selected Account
    Set Testnet    ${True}    ${SEPOLIA_RADIO}
    Open History
    ${previous}=    Newest Ethereum Transaction Id
    Go Home
    Open Ether Amount Entry
    Enter Amount    ${ETHER_SEND_AMOUNT}
    Open Destination
    Choose Own Address As Recipient    ${address}
    Confirmation Should Show Amount    ${ETHER_SEND_AMOUNT}
    Slide To Confirm    ${SEND_CONFIRM_SLIDE}
    Wait Until Page Contains Element    ${SEND_SUCCESS}    timeout=60s
    # Ethereum does not confirm on submit, so this holds whatever the block time.
    Wait Until Page Contains    ${SEND_AWAITING_TITLE}    timeout=5s
    Tap    ${SEND_SUCCESS_DONE}
    Go Home
    Open History
    ${hash}=    Wait Until Keyword Succeeds    60s    3s    New Ethereum Transaction Should Be Listed    ${previous}
    Wait Until Keyword Succeeds    4 min    15s    Ethereum Transaction Should Be Confirmed    ${hash}

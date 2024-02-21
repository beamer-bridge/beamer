// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../../interfaces/IMessenger.sol";
import "../../RestrictedCalls.sol";
import "../../Resolver.sol";
import "zksync/AddressAliasHelper.sol";
import "zksync/IMailbox.sol";
import "zksync/L2ContractHelper.sol";

address constant L2_TO_L1_MESSENGER_SYSTEM_CONTRACT_ADDR = address(0x8008);
// TODO remove
// address constant MAILBOX_FACET_ADDR = 0xb2097DBe4410B538a45574B1FCD767E2303c7867;
// uint256 constant REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT = 800;

contract ZkSyncL1Messenger is IMessenger, RestrictedCalls {
    Resolver public immutable resolver;
    address public immutable l2MessengerAddress;
    IMailbox public immutable mailbox;
    uint256 public immutable l2GasPerPubdataByteLimit;

    // NOTE: The zkSync contract implements only the functionality for proving that a message belongs to a block
    // but does not guarantee that such a proof was used only once. That's why a contract that uses L2 -> L1
    // communication must take care of the double handling of the message.
    /// @dev mapping L2 block number => message number => flag
    /// @dev Used to indicated that zkSync L2 -> L1 message was already processed
    mapping(uint256 => mapping(uint256 => bool)) public isL2ToL1MessageProcessed;

    /// Maps addresses to ETH deposits to be used for paying the base cost.
    mapping(address depositor => uint256 deposit) public deposits;

    constructor(
        address resolver_,
        address l2MessengerAddress_,
        address mailboxAddress_,
        uint256 l2GasPerPubdataByteLimit_)
    {
        resolver = Resolver(resolver_);
        l2MessengerAddress = l2MessengerAddress_;
        mailbox = IMailbox(mailboxAddress_);
    }

    function callAllowed(
        address caller,
        address courier
    ) external view returns (bool) {
        return true;
        // TODO
        // return
        //     courier == address(zkSyncMailbox) &&
        //     caller == nativeMessenger.xDomainMessageSender();
    }

    function deposit() external payable {
        deposits[msg.sender] += msg.value;
    }

    function _withdraw(address target) private {
        uint256 amount = deposits[target];
        require(amount > 0, "nothing to withdraw");

        deposits[target] = 0;

        (bool sent, ) = target.call{value: amount}("");
        require(sent, "failed to send Ether");
    }

    function withdraw() public {
        _withdraw(msg.sender);
    }

    function sendMessage(
        address target,
        bytes calldata message
    ) external restricted(block.chainid) {
        // 2. get current l1 gas price
        uint256 l1GasPrice = tx.gasprice;

        // TODO estimate l2 gas
        // only easily possible via zks_estimateGasL1ToL2 rpc method.
        // Find solution to provide it externally or calculate an estimate here in the contract
        // the address of this contract needs to be aliased when estimating l2 gas!
        uint256 l2GasLimit = 0;

        uint256 baseCost = mailbox.l2TransactionBaseCost(
            l1GasPrice,
            l2GasLimit,
            l2GasPerPubdataByteLimit
        )

        uint256 depositOrigin = deposits[tx.origin];
        require(depositOrigin >= baseCost, "insufficient deposit");

        deposits[tx.origin] = depositOrigin - baseCost;

        mailbox.requestL2Transaction{value: baseCost}(
            target,
            0,
            message,
            l2GasLimit,
            l2GasPerPubdataByteLimit, 
            new bytes[](0),
            tx.origin,
        );

        if (deposits[tx.origin] > 0) _withdraw(tx.origin);
    }

    function executeMessageFromL2(
        // zkSync block number in which the message was sent
        uint256 l2BlockNumber,
        // Message index, that can be received via API
        uint256 index,
        // The tx number in block
        uint16 l2TxNumberInBlock,
        // The message that was sent from l2
        bytes calldata message,
        // Merkle proof for the message
        bytes32[] calldata proof
    ) external {
        L2Message memory l2Message = L2Message({sender: l2MessengerAddress, data: message, txNumberInBlock: l2TxNumberInBlock});

        bool success = mailbox.proveL2MessageInclusion(
            l2BlockNumber,
            index,
            l2Message,
            proof
        );
        require(success, "Failed to prove message inclusion");

        isL2ToL1MessageProcessed[l2BlockNumber][index] = true;

        (bool sent, ) = address(resolver).call(message);
        require(sent, "Relaying message failed");
    }
}

contract ZkSyncL2Messenger is IMessenger, RestrictedCalls {
    function callAllowed(
        address caller,
        address courier
    ) external view returns (bool) {
        return courier ==
            AddressAliasHelper.applyL1ToL2Alias(caller);
    }

    function sendMessage(
        address,
        bytes calldata message
    ) external restricted(block.chainid) {
        IL2Messenger messenger = IL2Messenger(L2_TO_L1_MESSENGER_SYSTEM_CONTRACT_ADDR);
        messenger.sendToL1(message);
    }
}

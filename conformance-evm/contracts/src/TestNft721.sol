// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

contract TestNft721 {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function mint(address to, uint256 id) external {
        require(to != address(0), "mint to zero");
        require(_owners[id] == address(0), "already minted");
        _owners[id] = to;
        balanceOf[to]++;
        emit Transfer(address(0), to, id);
    }

    function ownerOf(uint256 id) public view returns (address owner) {
        owner = _owners[id];
        require(owner != address(0), "nonexistent token");
    }

    function approve(address to, uint256 id) external {
        address owner = ownerOf(id);
        require(msg.sender == owner || isApprovedForAll[owner][msg.sender], "not authorized");
        getApproved[id] = to;
        emit Approval(owner, to, id);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 id) public {
        address owner = ownerOf(id);
        require(owner == from, "wrong owner");
        require(to != address(0), "transfer to zero");
        require(
            msg.sender == owner || getApproved[id] == msg.sender || isApprovedForAll[owner][msg.sender],
            "not authorized"
        );
        delete getApproved[id];
        balanceOf[from]--;
        balanceOf[to]++;
        _owners[id] = to;
        emit Transfer(from, to, id);
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        safeTransferFrom(from, to, id, "");
    }

    function safeTransferFrom(address from, address to, uint256 id, bytes memory data) public {
        transferFrom(from, to, id);
        if (to.code.length > 0) {
            require(
                IERC721Receiver(to).onERC721Received(msg.sender, from, id, data)
                    == IERC721Receiver.onERC721Received.selector,
                "unsafe recipient"
            );
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd;
    }
}

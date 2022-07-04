// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/ERC721.sol)

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


/**
 * @dev Implementation of https://eips.ethereum.org/EIPS/eip-721[ERC721] Non-Fungible Token Standard, including
 * the Metadata extension, but not including the Enumerable extension, which is available separately as
 * {ERC721Enumerable}.
 */
contract MemberCard is Context, ERC165, IERC721, IERC721Metadata, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;
    using Strings for uint256;

    struct Membership  {
        uint256 startTime;
        uint256 expireTime;
        uint256 counter;        
    }

    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    // Mapping from token ID to owner address
    mapping(uint256 => address) private _owners;

    // Mapping owner address to token count
    mapping(address => uint256) private _balances;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    mapping(address => mapping(uint256 => uint256)) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;
    uint256[] private _allTokens;
    mapping(uint256 => uint256) private _allTokensIndex;

    mapping(uint256 => string) private _tokenURIs;

    uint256 private _buyFees;

    address private _owner;

    uint256 private _currentBatch;

    mapping(address => mapping(uint256 => bool)) private _batchParticipation;

    mapping(uint256 => Membership) private _membership;

    mapping(uint256 => bool) private _frozen;

    mapping(uint256 => bool) private _transferRestriction;

    mapping(address => bool) private _vendors;

    uint256 private _tokenCounter;

    uint256 private _maxTokenCounter;

    IERC20 private _paymentToken;

    address private treasury;

    mapping(address => bool) private _admins;




    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SetAdmin(address indexed user, bool indexed allow);
    event SetTreasury(address indexed oldTreasury, address indexed newTreasury);
    event SetFreezeStatus(uint256 indexed tokenId, bool indexed frozen);
    event SetStartTime(uint256 indexed tokenId, uint256 indexed time);
    event SetExpireTime(uint256 indexed tokenId, uint256 indexed time);
    event SetCounter(uint256 indexed tokenId, uint256 indexed counter);
    event SetTransferRestriction(uint256 indexed tokenId, bool indexed allow);
    event SetVendor(address indexed vendor, bool indexed allow);
    event SetNewBatchTokens(uint256 indexed tokensToAdd);

    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor() {}

    function initialize(address owner_, string memory name_, string memory symbol_) public initializer {
        _paymentToken = IERC20(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);
        _setOwner(owner_);
        treasury = 0x35b119730F79881DAc623dc51c831C6A04cAB5f3;
         _name = name_;
        _symbol = symbol_;
        _buyFees = 1e20;
        
    }

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require((owner() == _msgSender() || _admins[_msgSender()]), "Ownable: caller is not an admin");
        _;
    }

    modifier onlyVendor() {
        require(_vendors[_msgSender()], "NFT: caller is not a vendor.");
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function setAdmin(address user, bool allow) public onlyOwner {
        _admins[user] = allow;
        emit SetAdmin(user, allow);
    }
    
    




    // custom functions

    function setTreasury(address account) public virtual onlyAdmin {
        address oldTreasury = treasury;
        treasury = account;
        emit SetTreasury(oldTreasury, treasury);
    }
    

    function setFreezeStatus(uint256 tokenId, bool frozen) public virtual onlyAdmin {
        _frozen[tokenId] = frozen;
        emit SetFreezeStatus(tokenId, frozen);
    }

    function setStartTime(uint256 tokenId, uint256 time) public virtual onlyAdmin {
        _membership[tokenId].startTime = time;
        emit SetStartTime(tokenId, time);
    }

    function setExpireTime(uint256 tokenId, uint256 time) public virtual onlyAdmin {
        _membership[tokenId].expireTime = time;
        emit SetExpireTime(tokenId, time);
    }

    function setCounter(uint256 tokenId, uint256 counter) public virtual onlyAdmin {
        _membership[tokenId].counter = counter;
        emit SetCounter(tokenId, counter);
    }

    function setTransferRestriction(uint256 tokenId, bool allow) public virtual onlyAdmin {
        _transferRestriction[tokenId] = allow;
        emit SetTransferRestriction(tokenId, allow);
    }

    function setVendor(address vendor, bool allow) public virtual onlyAdmin {
        _vendors[vendor] = allow;
        emit SetVendor(vendor, allow);
    }

    function setNewBatchTokens(uint256 tokensToAdd) public virtual onlyAdmin {
        _maxTokenCounter = tokensToAdd;
        _currentBatch = _currentBatch+1;
        emit SetNewBatchTokens(tokensToAdd);
    }

    // assumes blind Trust on vendor contract as they are part of the ecosystem

    function consumeMembership(uint256 tokenId) public virtual onlyVendor {
        require(_membership[tokenId].counter >0, "Member Card has been used. Purchase a new one to avail the benefits.");
        require(_membership[tokenId].expireTime >block.timestamp, "Member Card has been expired. Purchase a new one to avail the benefits.");
        require(!_frozen[tokenId], "Member Card has been frozen.");
        _membership[tokenId].counter = _membership[tokenId].counter-1;

    }

    function mintMemberCard(uint256 startTime, uint256 expireTime, uint256 counter, address user, string memory tokenURI_) public virtual onlyAdmin {
        uint256 tokenId = _tokenCounter;
        _mint(user, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        _membership[tokenId] = Membership(startTime, expireTime, counter);
        _tokenCounter++;
    }

    function mintMemberCard(address user, string memory tokenURI_) public virtual onlyAdmin {
        uint256 tokenId = _tokenCounter;
        _mint(user, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        _membership[tokenId] = Membership(block.timestamp, block.timestamp + 90 days, 3);
        _tokenCounter++;
    }

    function getMemberCardActive(uint256 tokenId) public view returns(bool) {
        bool active = (_membership[tokenId].counter >0 && _membership[tokenId].expireTime >block.timestamp && !_frozen[tokenId]);
        return active;
    }

    function getMemberCardStartTime(uint256 tokenId) public view returns(uint256) {
        return _membership[tokenId].startTime;
    }

    function getMemberCardExpireTime(uint256 tokenId) public view returns(uint256) {
        return _membership[tokenId].expireTime;
    }

    function getMemberCardCounter(uint256 tokenId) public view returns(uint256) {
        return _membership[tokenId].counter;
    }

    function getTokenCounter() public view returns(uint256) {
        return _maxTokenCounter;
    }

    function isMember(address user) public view returns(bool) {
        uint256 balance = MemberCard.balanceOf(user);
        bool member;
        uint256 tid;
        for (uint256 i = 0; i < balance; i++){
            tid = tokenOfOwnerByIndex(user, i);
            bool allow = getMemberCardActive(tid);
            if (allow) {
                return true;
            }
        }
        return member;
    }



    function activateMemberCard(uint256 tokenId, uint256 startTime, uint256 expireTime, uint256 counter, string memory tokenURI_) public virtual onlyAdmin {
        _setTokenURI(tokenId, tokenURI_);
        _membership[tokenId] = Membership(startTime, expireTime, counter);
    }

    function buy() public virtual nonReentrant {
        require(!_batchParticipation[_msgSender()][_currentBatch], "User already own an active Access Key in the current Batch.");
        uint256 tokenId = _tokenCounter;
        require(tokenId < _maxTokenCounter, "No more NFTs can be bought in the current batch.");
        _paymentToken.safeTransferFrom(_msgSender(), treasury, _buyFees);
        _mint(_msgSender(), tokenId);
        _batchParticipation[_msgSender()][_currentBatch] = true;
        _tokenCounter++;

    }

    function prize(address user) onlyAdmin public virtual {
        require(!_batchParticipation[user][_currentBatch], "User already own an active Access Key in the current Batch.");
        uint256 tokenId = _tokenCounter;
        require(tokenId < _maxTokenCounter, "No more NFTs can be bought in the current batch.");
        _mint(user, tokenId);
        _batchParticipation[user][_currentBatch] = true;
        _tokenCounter++;

    }


    





    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function balanceOf(address owner_) public view virtual override returns (uint256) {
        require(owner_ != address(0), "ERC721: balance query for the zero address");
        return _balances[owner_];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner_ = _owners[tokenId];
        require(owner_ != address(0), "ERC721: owner query for nonexistent token");
        return owner_;
    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721: URI query for nonexistent token"
        );

        string memory _tokenURI = _tokenURIs[tokenId];
        return _tokenURI;
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI)
        internal
        virtual
    {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI set of nonexistent token"
        );
        _tokenURIs[tokenId] = _tokenURI;
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overriden in child contracts.
     */
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address to, uint256 tokenId) public virtual override {
        address owner_ = MemberCard.ownerOf(tokenId);
        require(to != owner_, "ERC721: approval to current owner");

        require(
            _msgSender() == owner_ || isApprovedForAll(owner_, _msgSender()),
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");

        return _tokenApprovals[tokenId];
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address owner_, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");

        _transfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _safeTransfer(from, to, tokenId, _data);
    }

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * `_data` is additional data, it has no specified format and it is sent in call to `to`.
     *
     * This internal function is equivalent to {safeTransferFrom}, and can be used to e.g.
     * implement alternative mechanisms to perform token transfer, such as signature-based.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != address(0);
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner_ = MemberCard.ownerOf(tokenId);
        return (spender == owner_ || getApproved(tokenId) == spender || isApprovedForAll(owner_, spender));
    }

    /**
     * @dev Safely mints `tokenId` and transfers it to `to`.
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    /**
     * @dev Same as {xref-ERC721-_safeMint-address-uint256-}[`_safeMint`], with an additional `data` parameter which is
     * forwarded in {IERC721Receiver-onERC721Received} to contract recipients.
     */
    function _safeMint(
        address to,
        uint256 tokenId,
        bytes memory _data
    ) internal virtual {
        _mint(to, tokenId);
        require(
            _checkOnERC721Received(address(0), to, tokenId, _data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _beforeTokenTransfer(address(0), to, tokenId);

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal virtual {
        address owner_ = MemberCard.ownerOf(tokenId);

        _beforeTokenTransfer(owner_, address(0), tokenId);

        // Clear approvals
        _approve(address(0), tokenId);

        _balances[owner_] -= 1;
        delete _owners[tokenId];

        emit Transfer(owner_, address(0), tokenId);
    }

    /**
     * @dev Transfers `tokenId` from `from` to `to`.
     *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {
        require(MemberCard.ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");

        _beforeTokenTransfer(from, to, tokenId);

        // Clear approvals from the previous owner
        _approve(address(0), tokenId);

        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    /**
     * @dev Approve `to` to operate on `tokenId`
     *
     * Emits a {Approval} event.
     */
    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(MemberCard.ownerOf(tokenId), to, tokenId);
    }

    /**
     * @dev Approve `operator` to operate on all of `owner` tokens
     *
     * Emits a {ApprovalForAll} event.
     */
    function _setApprovalForAll(
        address owner_,
        address operator,
        bool approved
    ) internal virtual {
        require(owner_ != operator, "ERC721: approve to caller");
        _operatorApprovals[owner_][operator] = approved;
        emit ApprovalForAll(owner_, operator, approved);
    }

    /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * @param _data bytes optional data to send along with the call
     * @return bool whether the call correctly returned the expected magic value
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    function tokenOfOwnerByIndex(address owner_, uint256 index)
        public
        view
        virtual
        returns (uint256)
    {
        require(
            index < MemberCard.balanceOf(owner_),
            "ERC721Enumerable: owner index out of bounds"
        );
        return _ownedTokens[owner_][index];
    }

    

    function totalSupply() public view virtual returns (uint256) {
        return _allTokens.length;
    }

    function tokenByIndex(uint256 index)
        public
        view
        virtual
        
        returns (uint256)
    {
        require(
            index < MemberCard.totalSupply(),
            "ERC721Enumerable: global index out of bounds"
        );
        return _allTokens[index];
    }

    

    function _addTokenToOwnerEnumeration(address to, uint256 tokenId) private {
        uint256 length = MemberCard.balanceOf(to);
        _ownedTokens[to][length] = tokenId;
        _ownedTokensIndex[tokenId] = length;
    }

    function _addTokenToAllTokensEnumeration(uint256 tokenId) private {
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
    }

    function _removeTokenFromOwnerEnumeration(address from, uint256 tokenId)
        private
    {
        uint256 lastTokenIndex = MemberCard.balanceOf(from) - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];

        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];

            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }

        delete _ownedTokensIndex[tokenId];
        delete _ownedTokens[from][lastTokenIndex];
    }

    function _removeTokenFromAllTokensEnumeration(uint256 tokenId) private {
        uint256 lastTokenIndex = _allTokens.length - 1;
        uint256 tokenIndex = _allTokensIndex[tokenId];

        uint256 lastTokenId = _allTokens[lastTokenIndex];

        _allTokens[tokenIndex] = lastTokenId;
        _allTokensIndex[lastTokenId] = tokenIndex;

        delete _allTokensIndex[tokenId];
        _allTokens.pop();
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting
     * and burning.
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, ``from``'s `tokenId` will be
     * transferred to `to`.
     * - When `from` is zero, `tokenId` will be minted for `to`.
     * - When `to` is zero, ``from``'s `tokenId` will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {
        require((_transferRestriction[tokenId] || from == address(0)), "NFT cannot be transferred, ask admin to grant approval.");
        _transferRestriction[tokenId] = false;
        if (from == address(0)) {
            _addTokenToAllTokensEnumeration(tokenId);
        } else if (from != to) {
            _removeTokenFromOwnerEnumeration(from, tokenId);
        }
        if (to == address(0)) {
            _removeTokenFromAllTokensEnumeration(tokenId);
        } else if (to != from) {
            _addTokenToOwnerEnumeration(to, tokenId);
        }
    }

    function setBuyFees(uint256 fees) public virtual onlyAdmin {
        _buyFees = fees;
    }
}

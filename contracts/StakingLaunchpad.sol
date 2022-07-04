// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

/**
 *  @title  Dev Staking Pool
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract is created for staking pool for user owning duke box can stake amount of token
 *          to get with attractive rewardin 9 months from start day.
 *          The contract here by is implemented to create opportunities for users to drive project growth
 */
contract StakingLaunchpad is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct UserHistory {
        string action;
        uint256 timestamp;
        uint256 amount;
    }

    struct Lazy {
        uint256 unlockedTime;
        bool isRequested;
    }

    struct UserInfo {
        uint256 totalAmount;
        uint256 pendingRewards;
        uint256 indexLength;
        uint256 lastClaim;
        Lazy lazyUnstake;
        Lazy lazyClaim;
        UserHistory[] userHistory;
    }

    /**
     *  @notice stakedAmount uint256 is amount of staked token.
     */
    uint256 public stakedAmount;

    /**
     *  @notice rewardRate uint256 is rate of token.
     */
    uint256 public rewardRate;

    /**
     *  @notice poolDuration uint256 is duration of staking pool to end-time.
     */
    uint256 public poolDuration;

    /**
     *  @notice pendingUnstake uint256 is time after request unstake for waiting.
     */
    uint256 public pendingUnstake;

    /**
     *  @notice startTime is timestamp start staking in pool.
     */
    uint256 public startTime;

    /**
     *  @notice maxStakedAmount uint256 is max number of token which staked.
     */
    uint256 public maxStakedAmount;

    /**
     *  @notice stakeToken IERC20 is interface of staked token.
     */
    IERC20Upgradeable public stakeToken;

    /**
     *  @notice rewardToken IERC20 is interfacce of reward token.
     */
    IERC20Upgradeable public rewardToken;

    /**
     *  @notice Mapping an address to a information of corresponding user address.
     */
    mapping(address => UserInfo) public users;

    event Staked(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed time
    );
    event UnStaked(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed time
    );
    event Claimed(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed time
    );
    event EmergencyWithdrawed(
        address indexed owner,
        address indexed token,
        uint256 indexed time
    );
    event SetRewardRate(uint256 indexed rate, uint256 indexed time);
    event SetUnstakeTime(uint256 indexed pendingTime, uint256 indexed time);
    event SetStakeTime(uint256 indexed endTime, uint256 indexed time);
    event SetDuration(uint256 indexed poolDuration, uint256 indexed time);
    event SetStartTime(uint256 indexed poolDuration, uint256 indexed time);
    event RequestUnstake(address indexed sender, uint256 indexed timestamp);
    event RequestClaim(address indexed sender, uint256 indexed timestamp);

    /**
     *  @notice Initialize new logic contract.
     */
    function initialize(
        address owner_,
        IERC20Upgradeable _stakeToken,
        IERC20Upgradeable _rewardToken,
        uint256 _startTime,
        uint256 rewardRate_,
        uint256 poolDuration_,
        uint256 maxStakedAmount_
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        transferOwnership(owner_);
        stakeToken = _stakeToken;
        rewardToken = _rewardToken;
        startTime = _startTime;
        rewardRate = rewardRate_;
        poolDuration = poolDuration_;
        maxStakedAmount = maxStakedAmount_;
        pendingUnstake = 1 days;
    }

    /**
     *  @notice Set start time of staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setStartTime(uint256 _startTime) public onlyOwner {
        startTime = _startTime;
        emit SetStartTime(startTime, block.timestamp);
    }

    /**
     *  @notice Set reward rate of staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setRewardRate(uint256 _rewardRate) public onlyOwner {
        rewardRate = _rewardRate;
        emit SetRewardRate(rewardRate, block.timestamp);
    }

    /**
     *  @notice Set pending time for unstake from staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setPendingUnstake(uint256 _pendingTime) public onlyOwner {
        pendingUnstake = _pendingTime;
        emit SetUnstakeTime(pendingUnstake, block.timestamp);
    }

    /**
     *  @notice Set pool duration.
     *
     *  @dev    Only owner can call this function.
     */
    function setPoolDuration(uint256 _poolDuration) public onlyOwner {
        poolDuration = _poolDuration;
        emit SetDuration(poolDuration, block.timestamp);
    }

    /**
     *  @notice Get amount of deposited token of corresponding user address.
     */
    function getUserAmount(address user) public view returns (uint256) {
        return users[user].totalAmount;
    }

    /**
     *  @notice Stake amount of token to staking pool.
     *
     *  @dev    Everybody can call this function.
     */
    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Invalid amount");
        uint256 currentTime = block.timestamp;
        require(
            currentTime <= startTime + poolDuration,
            "Staking has already ended"
        );

        // Calculate pending reward
        UserInfo storage user = users[_msgSender()];
        if (user.totalAmount > 0) {
            uint256 pending = calReward(_msgSender());
            if (pending > 0) {
                user.pendingRewards = user.pendingRewards + pending;
            }
        }

        user.lastClaim = currentTime;
        require(
            stakedAmount + _amount <= maxStakedAmount,
            "Staking: Max staking limit has been reached."
        );
        // Request transfer from user to contract
        user.totalAmount += _amount;
        stakedAmount += _amount;
        stakeToken.safeTransferFrom(_msgSender(), address(this), _amount);
        user.indexLength++;
        user.userHistory.push(
            UserHistory("Staked", user.totalAmount, currentTime)
        );

        emit Staked(_msgSender(), _amount, currentTime);
    }

    /**
     *  @notice Check a mount of pending reward in pool of corresponding user address.
     */
    function pendingRewards(address _user) public view returns (uint256) {
        UserInfo memory user = users[_user];
        if (startTime > 0 && startTime <= block.timestamp) {
            uint256 amount = calReward(_user);
            amount = amount + user.pendingRewards;
            return amount;
        }
        return 0;
    }

    /**
     *  @notice Request withdraw before unstake activity
     */
    function requestUnstake() external {
        require(startTime > 0, "Pool is not start !");
        UserInfo storage user = users[_msgSender()];
        uint256 currentTime = block.timestamp;
        require(
            currentTime > startTime + poolDuration,
            "Not allow unstake at this time"
        );
        require(user.totalAmount > 0, "User is not staking !");
        require(!user.lazyUnstake.isRequested, "Requested !");
        user.lazyUnstake.isRequested = true;
        user.lazyUnstake.unlockedTime = currentTime + pendingUnstake;
        emit RequestUnstake(_msgSender(), currentTime);
    }

    /**
     *  @notice Request claim before unstake activity
     */
    function requestClaim() external {
        require(startTime > 0, "Pool is not start !");
        UserInfo storage user = users[_msgSender()];
        uint256 currentTime = block.timestamp;
        require(user.totalAmount > 0, "User is not staking !");
        require(!user.lazyClaim.isRequested, "Requested !");

        user.lazyClaim.isRequested = true;
        user.lazyClaim.unlockedTime = currentTime + pendingUnstake;
        emit RequestClaim(_msgSender(), currentTime);
    }

    /**
     *  @notice Claim all reward in pool.
     */
    function claim() external nonReentrant {
        UserInfo storage user = users[_msgSender()];
        uint256 currentTime = block.timestamp;
        require(
            user.lazyClaim.isRequested &&
                user.lazyClaim.unlockedTime <= currentTime,
            "Please request and can claim after 24 hours"
        );
        require(user.totalAmount > 0, "Reward value equal to zero");
        user.lazyClaim.isRequested = false;

        if (startTime <= currentTime) {
            uint256 pending = pendingRewards(_msgSender());
            if (pending > 0) {
                user.pendingRewards = 0;
                rewardToken.safeTransfer(_msgSender(), pending);
            }
            emit Claimed(_msgSender(), pending, currentTime);
        }

        user.lastClaim = currentTime;
        user.indexLength++;
        user.userHistory.push(
            UserHistory("Claimed", user.totalAmount, currentTime)
        );
    }

    /**
     *  @notice Unstake amount of rewards caller request.
     */
    function unstake(uint256 _amount) external nonReentrant {
        UserInfo storage user = users[_msgSender()];
        uint256 currentTime = block.timestamp;
        require(
            startTime + poolDuration <= currentTime,
            "Staking: StakingPool for NFT has not expired yet.."
        );
        require(
            user.lazyUnstake.isRequested &&
                user.lazyUnstake.unlockedTime <= currentTime,
            "Please request and can withdraw after 24 hours"
        );
        user.lazyUnstake.isRequested = false;

        // Auto claim
        if (user.totalAmount > 0) {
            if (startTime <= currentTime) {
                uint256 pending = pendingRewards(_msgSender());
                if (pending > 0) {
                    user.pendingRewards = 0;
                    rewardToken.safeTransfer(_msgSender(), pending);
                }
            }
        }

        user.lastClaim = currentTime;
        if (_amount > 0) {
            require(
                user.totalAmount >= _amount,
                "Staking: Cannot unstake more than staked amount."
            );

            user.totalAmount -= _amount;
            stakedAmount -= _amount;
            stakeToken.safeTransfer(_msgSender(), _amount);
            user.indexLength++;
            user.userHistory.push(
                UserHistory("Unstaked", user.totalAmount, currentTime)
            );
        }

        emit UnStaked(_msgSender(), _amount, currentTime);
    }

    /**
     *  @notice Admin can withdraw excess cash back.
     *
     *  @dev    Only admin can call this function.
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        if (rewardToken == stakeToken) {
            rewardToken.safeTransfer(
                owner(),
                rewardToken.balanceOf(address(this)) - stakedAmount
            );
        } else {
            rewardToken.safeTransfer(
                owner(),
                rewardToken.balanceOf(address(this))
            );
        }

        emit EmergencyWithdrawed(
            _msgSender(),
            address(rewardToken),
            block.timestamp
        );
    }

    /**
     *  @notice Return minimun value betwween two params.
     */
    function min(uint256 a, uint256 b) private pure returns (uint256) {
        if (a < b) return a;
        else return b;
    }

    /**
     *  @notice Return a pending amount of reward token.
     */
    function calReward(address _user) public view returns (uint256) {
        UserInfo memory user = users[_user];
        uint256 minTime = min(block.timestamp, startTime + poolDuration);
        if (minTime < user.lastClaim) {
            return 0;
        }
        uint256 amount = (user.totalAmount *
            (minTime - user.lastClaim) *
            rewardRate) / 1e18;
        return amount;
    }
}

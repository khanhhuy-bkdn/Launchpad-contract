// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

library Constant {
    uint256 internal constant FIXED_POINT = 1e18;

    /// These constants are calculated from algo (365)√(1 + APY)
    // and convert fo Fixed number with above FIXED_POINT
    // ROOT_30 has APY 100% => (365)√(1 + 100%) = 1.0019008376772
    uint256 internal constant ROOT_30 = 1001900837677200000;
    // ROOT_45 has APY 200% => (365)√(1 + 200%) = 1.0030144309684
    uint256 internal constant ROOT_45 = 1003014430968400000;
    // ROOT_60 has APY 300% => (365)√(1 + 300%) = 1.0038052885383
    uint256 internal constant ROOT_60 = 1003805288538300000;
}

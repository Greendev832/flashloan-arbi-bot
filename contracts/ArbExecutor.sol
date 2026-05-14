// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

contract ArbExecutor {
    address public owner;
    IPool public immutable pool;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address providerAddress) {
        owner = msg.sender;
        pool = IPool(IPoolAddressesProvider(providerAddress).getPool());
    }

    function startFlashLoanArb(
        address asset,
        uint256 amount,
        address[] calldata targets,
        bytes[] calldata calldatas,
        uint256 minProfit
    ) external onlyOwner {
        bytes memory params = abi.encode(targets, calldatas, minProfit);
        pool.flashLoanSimple(address(this), asset, amount, params, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == address(pool), "Not Aave pool");
        require(initiator == address(this), "Bad initiator");

        (
            address[] memory targets,
            bytes[] memory calldatas,
            uint256 minProfit
        ) = abi.decode(params, (address[], bytes[], uint256));

        require(targets.length == calldatas.length, "Length mismatch");

        uint256 amountOwed = amount + premium;

        require(
            IERC20(asset).balanceOf(address(this)) >= amount,
            "No flashloan balance"
        );

        if (targets.length > 0) {
            IERC20(asset).approve(targets[0], amount);
            require(
                IERC20(asset).allowance(address(this), targets[0]) >= amount,
                "Router approval failed"
            );
        }

        for (uint256 i = 0; i < targets.length; i++) {
            (bool ok, bytes memory result) = targets[i].call(calldatas[i]);
            if (!ok) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        }

        uint256 afterBal = IERC20(asset).balanceOf(address(this));
        require(afterBal >= amountOwed + minProfit, "Profit too small");

        IERC20(asset).approve(address(pool), amountOwed);
        return true;
    }

    function withdraw(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, bal);
    }
}

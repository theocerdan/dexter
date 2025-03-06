import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RouterModule = buildModule("RouterModule", (m) => {

    const router = m.contract("Router");
    const tokenA = m.contract("DumbERC20", ["TokenA", "TKA"], { id: "TokenA" });
    const tokenB = m.contract("DumbERC20", ["TokenB", "TKB"], { id: "TokenB" });

    const deployPair = m.call(router, "createPair", [tokenA, tokenB]);

    return { router }
});

export default RouterModule;
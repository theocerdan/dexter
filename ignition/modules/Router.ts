import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RouterModule = buildModule("Router", (m) => {


    const router = m.contract("Router", [m.getParameter("uniswapV2Router", "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3")], { id: "Router" });
    //const tokenA = m.contract("DumbERC20", ["TokenA", "TKA"], { id: "TokenA" });
    //const tokenB = m.contract("DumbERC20", ["TokenB", "TKB"], { id: "TokenB" });

    return { router }
});

export default RouterModule;
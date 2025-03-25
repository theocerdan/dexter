import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DexterManagerModule = buildModule("DexterManager", (m) => {


    const manager = m.contract("DexterManager", [m.getParameter("uniswapV2Router", "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3")], { id: "DexterManager" });


    //const manager = m.contract("Test", ["123"], { id: "Test" });


    return { manager }
});

export default DexterManagerModule;
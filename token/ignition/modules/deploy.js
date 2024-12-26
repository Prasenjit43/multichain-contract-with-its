const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("DeployModule", (m) => {
  // Deploy Token contract
  const Token = m.contract("Token", [
    "MyToken",
    "MTK",
    18,
    "50000000000000000", // 0.05 ETH
    "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C",
  ]);

  return {
    Token,
  };
});

// Avalanche: 0x74890887ebACC1dADC957D9E11652Fd430aA4355
// Fantom: 0x03d1D53d0946589DfFfeF187ead780EF49E92264
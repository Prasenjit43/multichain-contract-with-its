const hre = require("hardhat");
const crypto = require("crypto");
const {
  AxelarQueryAPI,
  Environment,
  EvmChain,
  GasToken,
} = require("@axelar-network/axelarjs-sdk");
const api = new AxelarQueryAPI({ environment: Environment.TESTNET });

const interchainTokenServiceContractABI = require("./utils/interchainTokenServiceABI");
const interchainTokenContractABI = require("./utils/interchainTokenABI");

const interchainTokenServiceContractAddress =
  "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C";

const avalancheTokenAddress = "0x74890887ebACC1dADC957D9E11652Fd430aA4355";
const fantomTokenAddress = "0x03d1D53d0946589DfFfeF187ead780EF49E92264";

const LOCK_UNLOCK_FEE = 3;
const MINT_BURN = 4;

async function getContractInstance(contractAddress, contractABI, signer) {
  return new ethers.Contract(contractAddress, contractABI, signer);
}

async function getSigner() {
  const [signer] = await ethers.getSigners();
  return signer;
}

// deploy Token Manager : Avalanche
async function deployTokenManagerAndAddAMinter() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  // Get the InterchainTokenService contract instance
  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );

  const interchainTokenContract = await getContractInstance(
    avalancheTokenAddress,
    interchainTokenContractABI,
    signer
  );

  // Generate a random salt
  const salt = "0x" + crypto.randomBytes(32).toString("hex");

  // Create the params
  const params = ethers.utils.defaultAbiCoder.encode(
    ["bytes", "address"],
    [signer.address, avalancheTokenAddress]
  );

  // Deploy the token manager
  const deployTxData = await interchainTokenServiceContract.deployTokenManager(
    salt,
    "",
    LOCK_UNLOCK_FEE,
    params,
    ethers.utils.parseEther("0.01")
  );

  // Get the tokenId
  const tokenId = await interchainTokenServiceContract.interchainTokenId(
    signer.address,
    salt
  );

  // Get the token manager address
  const expectedTokenManagerAddress =
    await interchainTokenServiceContract.tokenManagerAddress(tokenId);

  // Add token manager as a minter
  await interchainTokenContract.addMinter(expectedTokenManagerAddress);

  console.log(
    ` 
        Salt: ${salt},
        Transaction Hash: ${deployTxData.hash},
        Token ID: ${tokenId}, 
        Expected Token Manager Address: ${expectedTokenManagerAddress},
      `
  );

  //     Salt: 0x8bfe80fc2d5d11189f70516a0630de94ebd059fbeeb704f8b2a4d7be006f5733,
  //     Transaction Hash: 0xd29816f74ee4429afb24de81b65a0e805b2c350a2f5aaac342395b54a6161b46,
  //     Token ID: 0x07256ce1daceb2ddcbc08981a93222637c6612f190c487362d161ad0a0a4df35,
  //     Expected Token Manager Address: 0x3Ee3737C61788bb7d8D630611175EEC1F02F29c0,
}

// Mint and approve ITS
async function mintAndApproveITS() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  // Get the InterchainToken contract instance
  const interchainTokenContract = await getContractInstance(
    avalancheTokenAddress,
    interchainTokenContractABI,
    signer
  );

  // Mint tokens
  await interchainTokenContract.mint(
    signer.address,
    ethers.utils.parseEther("1000")
  );

  // Approve ITS
  await interchainTokenContract.approve(
    interchainTokenServiceContractAddress, // ITS address
    ethers.utils.parseEther("1000")
  );

  console.log("Minting and Approving ITS successful!");
}

// Estimate gas costs.
async function gasEstimator() {
  const gas = await api.estimateGasFee(
    EvmChain.AVALANCHE,
    EvmChain.FANTOM,
    GasToken.ETH,
    800000,
    1.1
  );

  return gas;
}

// deploy Token Manager : Fantom
async function deployTokenManagerRemotely() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  // Get the InterchainTokenService contract instance
  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );

  const interchainTokenContract = await getContractInstance(
    fantomTokenAddress,
    interchainTokenContractABI,
    signer
  );

  // Create the params
  const params = ethers.utils.defaultAbiCoder.encode(
    ["bytes", "address"],
    [signer.address, fantomTokenAddress]
  );

  const gasAmount = await gasEstimator();
  console.log("Gas Amount :", gasAmount);

  // Deploy the token manager remotely
  const deployTxData = await interchainTokenServiceContract.deployTokenManager(
    "0x2d5a55e7892972852bef954d86c3ff76a66d90019c48836dd329f9ad2ea268a1", // salt
    "Fantom",
    MINT_BURN,
    params,
    ethers.utils.parseEther("0.01"),
    { value: gasAmount }
  );

  // Get the tokenId
  const tokenId = await interchainTokenServiceContract.interchainTokenId(
    signer.address,
    "0x2d5a55e7892972852bef954d86c3ff76a66d90019c48836dd329f9ad2ea268a1" // salt
  );

  // Get the token manager address
  const expectedTokenManagerAddress =
    await interchainTokenServiceContract.tokenManagerAddress(tokenId);

  // Add token manager as a minter
  await interchainTokenContract.addMinter(expectedTokenManagerAddress);

  console.log(
    ` 
        Transaction Hash: ${deployTxData.hash},
        Token ID: ${tokenId}, 
        Expected Token Manager Address: ${expectedTokenManagerAddress},
      `
  );
}

// Transfer tokens : Avalanche -> Fantom
async function transferTokens() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );
  const gasAmount = await gasEstimator();
  // console.log("gasamount :", gasAmount);

  const transfer = await interchainTokenServiceContract.interchainTransfer(
    "0x2ce8622b285f279474c07e389e9c2a1bb90ba951e86bd9e25b14fd70161b0015", // tokenId, the one you store in the earlier step
    "Fantom",
    "0x874ff354224aa76f59e9779ac277a4F7d334017f", // receiver address
    ethers.utils.parseEther("100"), // amount of token to transfer
    "0x", // data
    ethers.utils.parseEther("0.01"), // fee
    {
      // Transaction options should be passed here as an object
      value: gasAmount,
    }
  );

  console.log("Transfer Transaction Hash:", transfer.hash);
}

async function main() {
  const functionName = process.env.FUNCTION_NAME;
  switch (functionName) {
    case "deployTokenManagerAndAddAMinter":
      await deployTokenManagerAndAddAMinter();
      break;
    case "mintAndApproveITS":
      await mintAndApproveITS();
      break;
    case "deployTokenManagerRemotely":
      await deployTokenManagerRemotely();
      break;
    case "transferTokens":
      await transferTokens();
      break;
    default:
      console.error(`Unknown function: ${functionName}`);
      process.exitCode = 1;
      return;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// FUNCTION_NAME=deployTokenManagerAndAddAMinter npx hardhat run index.js --network avalanche
// FUNCTION_NAME=mintAndApproveITS npx hardhat run index.js --network avalanche
// FUNCTION_NAME=deployTokenManagerRemotely npx hardhat run index.js --network avalanche
// FUNCTION_NAME=transferTokens npx hardhat run index.js --network avalanche

//   FUNCTION_NAME=deployTokenManagerAndAddAMinter npx hardhat run index.js --network avalanche

//         Salt: 0x2d5a55e7892972852bef954d86c3ff76a66d90019c48836dd329f9ad2ea268a1,
//         Transaction Hash: 0x8318ad88a28f1ef09d9f8b1a45d7908df9d50720bfa6eb89fed7a524b9a6f4f7,
//         Token ID: 0x2ce8622b285f279474c07e389e9c2a1bb90ba951e86bd9e25b14fd70161b0015,
//         Expected Token Manager Address: 0x4C263be55b0a7e4a46324a71200Abec4bdD46D9c,

// FUNCTION_NAME=deployTokenManagerRemotely npx hardhat run index.js --network avalanche
// Gas Amount : 47377763092995

//         Transaction Hash: 0x9a7ea178013cf81f6923682d38eb76675b5743ff5e2ac16f7bef1dba85c245aa,
//         Token ID: 0x2ce8622b285f279474c07e389e9c2a1bb90ba951e86bd9e25b14fd70161b0015,
//         Expected Token Manager Address: 0x4C263be55b0a7e4a46324a71200Abec4bdD46D9c,

import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

// Read configuration from your .env file
const ALGOD_TOKEN = process.env.ALGOD_API_TOKEN;
const ALGOD_SERVER = process.env.ALGOD_SERVER_URL;
const ALGOD_PORT = 443;
const a_mnemonic = process.env.A_MNEMONIC;

const checkAccountBalance = async () => {
    console.log("--- Checking Account Balance on TestNet ---");

    if (!a_mnemonic) {
        throw new Error("Mnemonic not found in .env file.");
    }

    try {
        const myAccount = algosdk.mnemonicToSecretKey(a_mnemonic);
        const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

        console.log("Account Address:", myAccount.addr);

        // 1. Get account information
        const accountInfo = await algodClient.accountInformation(myAccount.addr).do();
        
        // The balance is returned in microAlgos as a BigInt
        const balanceInMicroAlgos = accountInfo.amount;

        // --- THIS IS THE FIX ---
        // To divide a BigInt, you must divide it by another BigInt.
        // We do this by adding 'n' to the end of the number.
        const balanceInAlgos = balanceInMicroAlgos / 1_000_000n;

        console.log("\n------------------------------------------------");
        console.log(`Account Balance: ${balanceInAlgos} ALGO`);
        console.log(`(Raw Balance: ${balanceInMicroAlgos} microAlgos)`);
        console.log("------------------------------------------------");

    } catch (error) {
        console.error("Failed to check balance:", error);
    }
};

checkAccountBalance();
import algosdk from 'algosdk';
import dotenv from 'dotenv';

// --- Configuration ---
dotenv.config();
const a_mnemonic = process.env.A_MNEMONIC;
const ALGOD_TOKEN = process.env.ALGOD_API_TOKEN;
const ALGOD_SERVER = process.env.ALGOD_SERVER_URL;
const ALGOD_PORT = 443;

const runCorrectV3Test = async () => {
    console.log("--- Running Final Test with Correct Algorand SDK v3 Syntax ---");

    if (!a_mnemonic || !ALGOD_TOKEN || !ALGOD_SERVER) {
        console.error("ERROR: Missing environment variables.");
        return;
    }

    try {
        const creatorAccount = algosdk.mnemonicToSecretKey(a_mnemonic);
        const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
        
        // 1. Get network parameters (suggestedParams)
        const suggestedParams = await algodClient.getTransactionParams().do();
        console.log("✅ Network parameters fetched.");

        // 2. Compose the transaction using the correct v3 'FromObject' function and parameters
        const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
            // CORRECT v3 PARAMETER: 'sender' instead of 'from'
            sender: creatorAccount.addr, 
            
            suggestedParams, // Pass the suggested params
            
            // Asset-specific details
            assetName: "Test Badge Final",
            unitName: "FINAL",
            total: 1,
            decimals: 0,
            defaultFrozen: false,
            assetURL: "https://example.com/nft.json#arc3",
            manager: creatorAccount.addr,
            freeze: creatorAccount.addr,
            clawback: creatorAccount.addr,
            // 'reserve' is correctly omitted to create an immutable asset.
        });

        console.log("✅ Unsigned transaction created successfully.");

        // 3. Sign the transaction
        const signedTxn = txn.signTxn(creatorAccount.sk);
        console.log("✅ Transaction signed successfully.");
        
        // 4. Send the transaction
        const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
        console.log(`✅ Transaction sent! TX ID: ${txId}`);
        
        // 5. Wait for confirmation
        console.log("⏳ Waiting for transaction confirmation...");
        const result = await algosdk.waitForConfirmation(algodClient, txId, 4);
        const assetId = result['asset-index'];
        console.log(`\n🎉🎉🎉 SUCCESS! NFT Badge Minted! Asset ID: ${assetId} 🎉🎉🎉`);

    } catch (error) {
        console.error("--- TEST FAILED ---");
        console.error("This is unexpected. Please check the error details below:");
        console.error(error);
    }
};

runCorrectV3Test();
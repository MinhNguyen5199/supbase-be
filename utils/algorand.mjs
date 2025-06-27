import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

const ALGOD_TOKEN = process.env.ALGOD_API_TOKEN;
const ALGOD_SERVER = process.env.ALGOD_SERVER_URL;
const ALGOD_PORT = 443;
const a_mnemonic = process.env.A_MNEMONIC;

export const mintNftBadge = async (badgeDetails) => {
    console.log('-------- Minting NFT Badge on TestNet --------');
    if (!a_mnemonic) {
        throw new Error("Mnemonic for Algorand account is not set in environment variables.");
    }
    
    try {
        const creatorAccount = algosdk.mnemonicToSecretKey(a_mnemonic);
        const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

        console.log("Using account:", creatorAccount.addr);
        
        const suggestedParams = await algodClient.getTransactionParams().do();
        
        suggestedParams.flatFee = true;
        suggestedParams.fee = 2000;

        const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
            sender: creatorAccount.addr,
            suggestedParams,
            total: 1,
            decimals: 0,
            defaultFrozen: false,
            unitName: badgeDetails.name.slice(0, 8),
            assetName: badgeDetails.name.slice(0, 32),
            assetURL: badgeDetails.image_url + '#arc3',
            manager: creatorAccount.addr,
            reserve: creatorAccount.addr,
            freeze: creatorAccount.addr,
            clawback: creatorAccount.addr
        });
        
        const signedTxn = txn.signTxn(creatorAccount.sk);
        const { txid } = await algodClient.sendRawTransaction(signedTxn).do();

        if (!txid) {
            throw new Error("Transaction was rejected by the node.");
        }
        
        console.log(`Transaction sent successfully! TX ID: ${txid}`);
        console.log("Waiting for confirmation... This may take a few seconds.");

        // Manually poll for the transaction confirmation
        let confirmedTxn = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            try {
                confirmedTxn = await algodClient.pendingTransactionInformation(txid).do();
                if (confirmedTxn['confirmed-round'] !== null && confirmedTxn['confirmed-round'] > 0) {
                    console.log("Transaction confirmed in round " + confirmedTxn['confirmed-round']);
                    break;
                }
            } catch (e) { /* This can happen if the node is still processing */ }
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        if (!confirmedTxn) {
            throw new Error("Transaction not confirmed after multiple attempts.");
        }

        // --- THIS IS THE FINAL FIX ---
        // The property name in the v3 response is 'assetIndex' (camelCase)
        const assetId = confirmedTxn.assetIndex;

        if (assetId === undefined || assetId === null) {
             console.error("CRITICAL: Confirmed transaction does not contain an assetIndex.", confirmedTxn);
             throw new Error("Could not retrieve asset ID from confirmed transaction.");
        }

        console.log(`\n🎉 SUCCESS! NFT Badge Minted! Asset ID: ${assetId}`);
        console.log(`View on Pera TestNet Explorer: https://explorer.perawallet.app/testnet/asset/${assetId}/`);

        // Return the assetId as a number for your database
        return { assetId: Number(assetId), txId: txid };

    } catch (error) {
        console.error("\n--- FAILED TO MINT ALGORAND NFT BADGE ---");
        console.error("An unexpected error occurred:", error);
        throw new Error('Algorand minting failed.');
    }
};
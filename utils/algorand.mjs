import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

const ALGOD_TOKEN = process.env.ALGOD_API_TOKEN || '';
const ALGOD_SERVER = process.env.ALGOD_SERVER_URL || 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = process.env.ALGOD_PORT || 443;

const a_mnemonic = process.env.A_MNEMONIC;
if (!a_mnemonic) {
    throw new Error("Mnemonic for Algorand account is not set in environment variables.");
}
const { addr: creatorAddr, sk: creatorSk } = algosdk.mnemonicToSecretKey(a_mnemonic);

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

/**
 * Mints an Algorand Standard Asset (ASA) to represent an NFT badge.
 * @param {object} badgeDetails - Contains name, description, image_url.
 * @returns {Promise<{assetId: number, txId: string}>} The created asset ID and transaction ID.
 */
export const mintNftBadge = async (badgeDetails) => {
    try {
        const suggestedParams = await algodClient.getTransactionParams().do();

        const txn = algosdk.makeAssetCreateTxnWithSuggestedParams(
            creatorAddr,
            undefined, // note
            1,          // total issuance
            0,          // decimals
            true,       // defaultFrozen
            creatorAddr, // manager
            creatorAddr, // reserve
            creatorAddr, // freeze
            creatorAddr, // clawback
            badgeDetails.name.slice(0, 8), // unitName (max 8 chars)
            badgeDetails.name,             // assetName
            badgeDetails.image_url,        // url
            undefined, // metadataHash
            suggestedParams
        );

        const signedTxn = txn.signTxn(creatorSk);
        const { txId } = await algodClient.sendRawTransaction(signedTxn).do();

        const result = await algosdk.waitForConfirmation(algodClient, txId, 4);
        const assetId = result['asset-index'];

        console.log(`Successfully minted NFT Badge. Asset ID: ${assetId}, TX ID: ${txId}`);
        return { assetId, txId };
    } catch (error) {
        console.error("Failed to mint Algorand NFT badge:", error);
        throw new Error('Algorand minting failed.');
    }
};
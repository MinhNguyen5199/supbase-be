import algosdk from 'algosdk';

console.log("--- Generating New Algorand Account ---");

// 1. Generate a new, random account.
const newAccount = algosdk.generateAccount();

// 2. Convert the private key into the 25-word mnemonic phrase.
const mnemonic = algosdk.secretKeyToMnemonic(newAccount.sk);

// 3. THE FIX: Explicitly encode the public key into the user-friendly address string.
const addressString = algosdk.encodeAddress(newAccount.addr.publicKey);


console.log("\nSUCCESS! Your new account details are below.");
console.log("Please copy these details and store them in a very safe, private place.");
console.log("-----------------------------------------------------------------------");

// 4. Print the public address string.
// This is the format that the dispenser and other websites need.
console.log("Public Address:", addressString);

// 5. Print the 25-word mnemonic.
console.log("25-word Mnemonic:", mnemonic);

console.log("-----------------------------------------------------------------------");
console.log("Action Required: Copy the Public Address to fund it on the TestNet dispenser.");
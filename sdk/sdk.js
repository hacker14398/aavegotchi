const { RouterProtocol } = require("@routerprotocol/router-js-sdk");
const { ethers } = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

const main = async () => {
    // initialize a RouterProtocol instance
    let SDK_ID = "24"; // get your unique sdk id by contacting us on Telegram
    let chainId = 1;
    const provider = new ethers.providers.JsonRpcProvider(
        "https://cloudflare-eth.com/",
        chainId
    );
    const routerprotocol = new RouterProtocol(
        SDK_ID,
        chainId.toString(),
        provider
    );
    await routerprotocol.initailize();

    // get a quote for USDC transfer from Polygon to Fantom
    let args = {
        amount: ethers.utils.parseUnits("1", 18).toString(), // 1 DAI
        dest_chain_id: "137", // Matic
        src_token_address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI on Mainnet
        dest_token_address: "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7", // GHST on Polygon
        user_address: process.env.WALLET_ADDRESS
            ? process.env.WALLET_ADDRESS
            : "",
        fee_token_address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH on Mainnet
        slippage_tolerance: 2.0,
    };

    const quote = await routerprotocol.getQuote(
        args.amount,
        args.dest_chain_id,
        args.src_token_address,
        args.dest_token_address,
        args.user_address,
        args.fee_token_address,
        args.slippage_tolerance
    );

    // get allowance and give the relevant approvals
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "0x",
        provider
    ); // provider was set up while initializing an instance of RouterProtocol

    let src_token_allowance = await routerprotocol.getSourceTokenAllowance(
        args.src_token_address,
        args.dest_chain_id,
        args.user_address
    );
    if (src_token_allowance.lt(ethers.constants.MaxUint256)) {
        await routerprotocol.approveSourceToken(
            args.src_token_address,
            args.user_address,
            ethers.constants.MaxUint256.toString(),
            args.dest_chain_id,
            wallet
        );
    }
    // if (
    //     ethers.utils.getAddress(args.src_token_address) !==
    //     ethers.utils.getAddress(args.fee_token_address)
    // ) {
    //     let fee_token_allowance = await routerprotocol.getFeeTokenAllowance(
    //         args.fee_token_address,
    //         args.dest_chain_id,
    //         args.user_address
    //     );
    //     if (fee_token_allowance.lt(ethers.constants.MaxUint256)) {
    //         await routerprotocol.approveFeeToken(
    //             args.fee_token_address,
    //             args.user_address,
    //             ethers.constants.MaxUint256.toString(),
    //             wallet
    //         );
    //     }
    // }

    // execute the transaction
    let tx;
    try {
        tx = await routerprotocol.swap(quote, wallet);
        console.log(`Transaction successfully completed. Tx hash: ${tx.hash}`);
    } catch (e) {
        console.log(`Transaction failed with error ${e}`);
        return;
    }

    // fetching the status of the transaction
    setTimeout(async function () {
        let status = await routerprotocol.getTransactionStatus(tx.hash);
        console.log(status);
        if (status && status.tx_status_code === 1) {
            console.log("Transaction completed");
            // handle the case where the transaction is complete
        } else if (status && status.tx_status_code === 0) {
            console.log("Transaction still pending");
            // handle the case where the transaction is still pending
        }
    }, 180000); // waiting for sometime before fetching the status of the transaction because it may take some time for the transaction to get indexed
};

main();

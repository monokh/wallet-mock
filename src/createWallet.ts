import {
  Hex,
  Transport,
  createWalletClient,
  fromHex, publicActions, Account, http, toHex,
} from "viem";
import * as chains from "viem/chains";

export type Wallet = ReturnType<typeof createWallet>;

export function createWallet(account: Account, transports: Map<number, Transport>) {
  let chainId: string | undefined;
  return {
    request: async ({
      method,
      params,
    }: {
      method: string;
      params?: Array<unknown>;
    }) => {
      try {
        let chain = getChain(chainId);
        const client = createWalletClient({
          account,
          chain: chain,
          transport: transports.get(chain.id) ?? http(),
        }).extend(publicActions);

        if (method === "eth_accounts" || method === "eth_requestAccounts") {
          return await client.getAddresses();
        }

        if (
          method === "wallet_requestPermissions" ||
          method === "wallet_revokePermissions"
        ) {
          return [{ parentCapability: "eth_accounts" }];
        }

        if (method === "wallet_switchEthereumChain") {
          chainId = (params?.[0] as any).chainId;
          return null;
        }

        if (method === "personal_sign") {
          if (!client.account.signMessage) throw new Error("Method `personal_sign` not supported by account");
          return await client.account.signMessage({
            message: {
              raw: params?.[0] as Hex,
            },
          });
        }

        if (method === 'eth_chainId') {
          const chainIdResult = chainId ?? toHex(1);
          console.log("Returning: eth_chainId", chainIdResult);
          return chainIdResult;
        }

        if (method === "eth_sendRawTransaction") {
          console.log("eth_sendRawTransaction", params);
          return await client.sendRawTransaction({
            serializedTransaction: (params?.[0] as any),
          });
        }

        if (method === "eth_sendTransaction") {
          const from = (params?.[0] as any).from;
          if (from !== account.address) throw new Error("Invalid from address");
          const { to, data } = params?.[0] as any;
          let { value, maxFeePerGas, maxPriorityFeePerGas, gas, gasPrice } = params?.[0] as any;
          value = value && BigInt(value);
          gas = gas && BigInt(gas);
          gasPrice = gasPrice && BigInt(gasPrice);
          maxFeePerGas = maxFeePerGas && BigInt(maxFeePerGas);
          maxPriorityFeePerGas = maxPriorityFeePerGas && BigInt(maxPriorityFeePerGas);
          return await client.sendTransaction({
            to,
            value,
            data,
            gas,
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas,
          });
        }

        return await client.request({
          method: method as any,
          params: params as any,
        });
      } catch (error) {
        console.error("Error within Mock Wallet:", error);
        return null;
      }
    },
  };
}

function getChain(chainIdHex: string | undefined) {
  if (!chainIdHex) return chains.mainnet;

  const chainId = fromHex(chainIdHex as Hex, "number");
  for (const chain of Object.values(chains)) {
    if ("id" in chain) {
      if (chain.id === chainId) {
        return chain;
      }
    }
  }

  return chains.mainnet;
}

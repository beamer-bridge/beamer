import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';

import FillManager from '@/assets/FillManager.json';
import type { Cancelable } from '@/types/async';
import type { EthereumAddress } from '@/types/data';
import type { UInt256 } from '@/types/uint-256';

function getContract(rpcUrl: string, address: EthereumAddress): Contract {
  const provider = new JsonRpcProvider(rpcUrl);
  return new Contract(address, FillManager.abi, provider);
}

async function checkForPastFulfillmentEvent(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: UInt256,
): Promise<boolean> {
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = getContract(rpcUrl, fillManagerAddress);
  const currentBlockNumber = await provider.getBlockNumber();
  const eventFilter = contract.filters.RequestFilled(BigNumber.from(requestIdentifier.asString));
  const events = await contract.queryFilter(eventFilter, currentBlockNumber - 500);
  return events.length > 0;
}

export function waitForFulfillment(
  rpcUrl: string,
  fillManagerAddress: string,
  requestIdentifier: UInt256,
): Cancelable<void> {
  const contract = getContract(rpcUrl, fillManagerAddress);
  const eventFilter = contract.filters.RequestFilled(BigNumber.from(requestIdentifier.asString));
  const promise = new Promise<void>((resolve) => {
    const cleanUpAndResolve = () => {
      contract.removeAllListeners();
      resolve();
    };

    checkForPastFulfillmentEvent(rpcUrl, fillManagerAddress, requestIdentifier).then(
      (fulfilled) => {
        if (fulfilled) {
          cleanUpAndResolve();
        }
      },
    );

    contract.on(eventFilter, cleanUpAndResolve);
  });

  const cancel = () => contract.removeAllListeners();
  return { promise, cancel };
}

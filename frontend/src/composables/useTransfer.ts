import type { JsonRpcSigner } from '@ethersproject/providers';
import { computed, ref } from 'vue';

import { Transfer } from '@/actions/transfers';
import type { ChainConfigMapping, ChainWithTokens } from '@/types/config';
import type { Chain, Token } from '@/types/data';
import type { RequestFormResult } from '@/types/form';
import { EthereumAmount, TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export function useTransfer() {
  const transfer = ref<Transfer | undefined>(undefined);

  const isTransferInProgress = computed(() => {
    return transfer.value && (transfer.value.active || transfer.value.done);
  });

  const isNewTransferDisabled = computed(() => {
    return transfer.value !== undefined && !transfer.value.done;
  });

  const runTransfer = async (
    formResult: RequestFormResult,
    signer: JsonRpcSigner,
    signerAddress: string,
    fees: EthereumAmount,
    chains: ChainConfigMapping,
  ) => {
    const sourceConfiguration = chains[formResult.sourceChainId.value];
    const sourceChain = parseChainFromConfiguration(sourceConfiguration);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sourceToken = parseTokenFromChainConfiguration(
      sourceConfiguration,
      formResult.tokenAddress.label,
    )!;
    const sourceAmount = TokenAmount.parse(formResult.amount, sourceToken);

    const targetConfiguration = chains[formResult.targetChainId.value];
    const targetChain = parseChainFromConfiguration(targetConfiguration);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetToken = parseTokenFromChainConfiguration(
      targetConfiguration,
      formResult.tokenAddress.label,
    )!;
    const targetAmount = TokenAmount.parse(formResult.amount, targetToken);

    const validityPeriod = new UInt256('600');

    transfer.value = Transfer.new(
      sourceChain,
      sourceAmount,
      targetChain,
      targetAmount,
      formResult.toAddress,
      validityPeriod,
      fees,
    );

    try {
      await transfer.value.execute(signer, signerAddress);
    } catch (error: unknown) {
      console.error(error);
      console.log(transfer.value);
    }
  };

  return {
    transfer,
    runTransfer,
    isTransferInProgress,
    isNewTransferDisabled,
  };
}

function parseChainFromConfiguration(configuration: ChainWithTokens): Chain {
  return {
    identifier: configuration.identifier,
    name: configuration.name,
    rpcUrl: configuration.rpcUrl,
    requestManagerAddress: configuration.requestManagerAddress,
    fillManagerAddress: configuration.fillManagerAddress,
    explorerTransactionUrl: configuration.explorerTransactionUrl,
  };
}

function parseTokenFromChainConfiguration(
  configuration: ChainWithTokens,
  tokenName: string,
): Token | undefined {
  return configuration.tokens.find((token) => token.symbol === tokenName);
}

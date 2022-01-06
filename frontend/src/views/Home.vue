<template>
  <div class="home">
    <h1 class="home__title">Request</h1>
    <div v-if="criticalErrorMessage" class="home__error">{{ criticalErrorMessage }}</div>
    <div v-else-if="successfulTransactionUrl">
      Request successful! Click
      <a :href="successfulTransactionUrl" target="_blank" class="home__link"> here </a>
      to see transaction details.
    </div>
    <RequestForm
      v-else
      class="home__form"
      :loading="executingRequest"
      @formAccepted="executeRequestTransaction"
    />
    <div v-if="transactionErrorMessage" class="home__error">{{ transactionErrorMessage }}</div>
  </div>
</template>

<script lang="ts">
import {
  ExternalProvider,
  JsonRpcSigner,
  TransactionReceipt,
  TransactionResponse,
} from '@ethersproject/providers';
import detectEthereumProvider from '@metamask/detect-provider';
import { BigNumber, Contract } from 'ethers';
import { Options, Vue } from 'vue-class-component';

import CustomToken from '@/assets/CustomToken.json';
import RequestManager from '@/assets/RequestManager.json';
import RequestForm, { RequestFormResult } from '@/components/RequestForm.vue';
import { EthereumProvider, MetaMaskProvider } from '@/services/web3-provider';

@Options({
  components: {
    RequestForm,
  },
})
export default class Home extends Vue {
  executingRequest = false;
  criticalErrorMessage = '';
  transactionErrorMessage = '';
  successfulTransactionUrl = '';
  ethereumProvider!: EthereumProvider;

  async created(): Promise<void> {
    await this.createMetaMaskProvider();
    if (this.ethereumProvider) {
      this.checkChainId();
    }
  }

  private async executeRequestTransaction(formResult: RequestFormResult) {
    this.executingRequest = true;
    this.transactionErrorMessage = '';

    try {
      await this.ensureSigner();
      await this.ensureTokenAllowance(
        this.ethereumProvider.signer!,
        formResult.sourceTokenAddress,
        formResult.amount,
      );
      const transactionReceipt = await this.sendRequestTransaction(
        this.ethereumProvider.signer!,
        formResult.targetChainId,
        formResult.sourceTokenAddress,
        formResult.targetTokenAddress,
        formResult.targetAddress,
        formResult.amount,
      );
      this.successfulTransactionUrl =
        process.env.VUE_APP_ETHERSCAN_TX_URL! + transactionReceipt.transactionHash;
    } catch (error) {
      console.error(error);
      this.transactionErrorMessage = error.message;
    }

    this.executingRequest = false;
  }

  private async createMetaMaskProvider(): Promise<void> {
    const detectedProvider = (await detectEthereumProvider()) as ExternalProvider | undefined;
    if (detectedProvider && detectedProvider.isMetaMask) {
      this.ethereumProvider = new MetaMaskProvider(detectedProvider);
    } else {
      this.criticalErrorMessage = 'Could not detect MetaMask!';
    }
  }

  private async checkChainId(): Promise<void> {
    const chainId = await this.ethereumProvider.getChainId();
    const expectedChainId = Number(process.env.VUE_APP_CHAIN_ID!);
    if (chainId !== expectedChainId) {
      this.criticalErrorMessage = `Not connected to chain id ${expectedChainId}!`;
    }
  }

  private async ensureSigner(): Promise<void> {
    if (this.ethereumProvider.signer) {
      return;
    }
    await this.ethereumProvider.requestSigner();
    if (!this.ethereumProvider.signer) {
      throw Error('Accessing wallet failed!');
    }
  }

  private async ensureTokenAllowance(
    signer: JsonRpcSigner,
    tokenAddress: string,
    amount: BigNumber,
  ): Promise<void> {
    const tokenContract = new Contract(tokenAddress, CustomToken.abi, signer);
    const signerAddress = await signer.getAddress();
    const requestManagerAddress = process.env.VUE_APP_REQUEST_MANAGER_ADDRESS!;
    const allowance: BigNumber = await tokenContract.allowance(
      signerAddress,
      requestManagerAddress,
    );
    if (allowance.lt(amount)) {
      const transaction = await tokenContract.approve(requestManagerAddress, amount);
      await transaction.wait();
    }
  }

  private async sendRequestTransaction(
    signer: JsonRpcSigner,
    targetChainId: BigNumber,
    sourceTokenAddress: string,
    targetTokenAddress: string,
    targetAddress: string,
    amount: BigNumber,
  ): Promise<TransactionReceipt> {
    const requestManagerContract = new Contract(
      process.env.VUE_APP_REQUEST_MANAGER_ADDRESS!,
      RequestManager.abi,
      signer,
    );
    const transaction: TransactionResponse = await requestManagerContract.request(
      targetChainId,
      sourceTokenAddress,
      targetTokenAddress,
      targetAddress,
      amount,
    );
    return await transaction.wait();
  }
}
</script>

<style lang="scss" scoped>
@import '@/scss/colors';

.home {
  width: 600px;

  &__title {
    font-size: 36px;
    line-height: 48px;
    margin-bottom: 32px;
  }

  &__form {
    margin-bottom: 16px;
  }

  &__error {
    color: $error-color;
  }

  &__link {
    color: $primary;
  }
}
</style>

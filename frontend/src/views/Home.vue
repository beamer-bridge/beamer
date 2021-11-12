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
  Web3Provider,
} from '@ethersproject/providers';
import detectEthereumProvider from '@metamask/detect-provider';
import { BigNumber, Contract } from 'ethers';
import { Options, Vue } from 'vue-class-component';

import CustomToken from '@/assets/CustomToken.json';
import RequestManager from '@/assets/RequestManager.json';
import RequestForm, { RequestFormResult } from '@/components/RequestForm.vue';

@Options({
  components: {
    RequestForm,
  },
})
export default class Home extends Vue {
  private static CHAIN_ID = 5;
  private static REQUEST_MANAGER_ADDRESS = '0x6d18F474C0a16a96E3D24c9eC85BC82311B111c6';
  private static ETHERSCAN_TX_URL = 'https://goerli.etherscan.io/tx/';

  executingRequest = false;
  criticalErrorMessage = '';
  transactionErrorMessage = '';
  successfulTransactionUrl = '';
  web3Provider!: Web3Provider;

  async created(): Promise<void> {
    await this.detectEthereumProvider();
    this.checkChainId();
  }

  private async executeRequestTransaction(formResult: RequestFormResult) {
    this.executingRequest = true;
    this.transactionErrorMessage = '';

    try {
      const signer = await this.getDefaultSigner();
      await this.ensureTokenAllowance(signer, formResult.sourceTokenAddress, formResult.amount);
      const transactionReceipt = await this.sendRequestTransaction(
        signer,
        formResult.targetChainId,
        formResult.sourceTokenAddress,
        formResult.targetTokenAddress,
        formResult.targetAddress,
        formResult.amount,
      );
      this.successfulTransactionUrl = Home.ETHERSCAN_TX_URL + transactionReceipt.transactionHash;
    } catch (error) {
      console.error(error);
      this.transactionErrorMessage = error.message;
    }

    this.executingRequest = false;
  }

  private async detectEthereumProvider(): Promise<void> {
    const detectedProvider = await detectEthereumProvider();
    if (detectedProvider) {
      this.web3Provider = new Web3Provider(detectedProvider as ExternalProvider);
    } else {
      this.criticalErrorMessage = 'No web3 provider detected!';
    }
  }

  private async checkChainId(): Promise<void> {
    const { chainId } = await this.web3Provider.getNetwork();
    if (chainId !== Home.CHAIN_ID) {
      this.criticalErrorMessage = `Not connected to chain id ${Home.CHAIN_ID}!`;
    }
  }

  private async getDefaultSigner(): Promise<JsonRpcSigner> {
    const accounts = await this.web3Provider.listAccounts();
    if (accounts.length === 0) {
      await this.web3Provider.send('eth_requestAccounts', []);
    }
    return this.web3Provider.getSigner();
  }

  private async ensureTokenAllowance(
    signer: JsonRpcSigner,
    tokenAddress: string,
    amount: BigNumber,
  ): Promise<void> {
    const tokenContract = new Contract(tokenAddress, CustomToken.abi, signer);
    const signerAddress = await signer.getAddress();
    const allowance: BigNumber = await tokenContract.allowance(
      signerAddress,
      Home.REQUEST_MANAGER_ADDRESS,
    );
    if (allowance.lt(amount)) {
      const transaction = await tokenContract.approve(Home.REQUEST_MANAGER_ADDRESS, amount);
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
      Home.REQUEST_MANAGER_ADDRESS,
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

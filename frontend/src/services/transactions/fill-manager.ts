import { JsonRpcSigner, TransactionReceipt, TransactionResponse } from '@ethersproject/providers';
import { BigNumber, Contract} from 'ethers';
import { DeepReadonly, ref, Ref } from 'vue';

import {Request, RequestState} from '@/types/data'
import FillManager from '@/assets/FillManager.json';


function findFirstEvent(receipt: TransactionReceipt, eventName: string){
  const isRequestCreated = (e) => {
	  if ("undefined" === typeof(e["event"])) {
		  return false
	  }
	  console.log(e.event)
	  return e.event === eventName 
  }
  return receipt.events.find(isRequestCreated);
}


export function registerFillListener(
  signer: DeepReadonly<JsonRpcSigner>,
  request: Request,
  requestState: Ref<RequestState>
): void {
  const fillManagerContract = new Contract(request.fillManagerAddress, FillManager.abi, signer);
  console.log(request)


  requestState.value = RequestState.WaitFulfill;
  const onRequestFilled = (...args) => {
	console.log("Got events", args)
 // Contract: emit RequestFilled(requestId, sourceChainId, targetTokenAddress, msg.sender, amount);
	  //uint256 will be BigNumber
        //"eventSignature": "RequestFilled(uint256,uint256,address,address,uint256)",
	  // TODO match request id etc
  	requestState.value = RequestState.Successful;
  }


  //
  // TODO construct a specific filter: 
  //const filter = fillManagerContract.filters.RequestFilled(BigNumber.from(request.requestId), null,null,null,null);
  //
  //fillManagerContract.on(
	  //filter,
    //onRequestFilled,
  //);
  fillManagerContract.on(
    "RequestFilled", // matching on the request id
    onRequestFilled,
  );
  console.log("Listening for events.")

}

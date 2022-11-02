// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  ethereum,
  JSONValue,
  TypedMap,
  Entity,
  Bytes,
  Address,
  BigInt
} from "@graphprotocol/graph-ts";

export class ClaimMade extends ethereum.Event {
  get params(): ClaimMade__Params {
    return new ClaimMade__Params(this);
  }
}

export class ClaimMade__Params {
  _event: ClaimMade;

  constructor(event: ClaimMade) {
    this._event = event;
  }

  get requestId(): BigInt {
    return this._event.parameters[0].value.toBigInt();
  }

  get claimId(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get claimer(): Address {
    return this._event.parameters[2].value.toAddress();
  }

  get claimerStake(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get lastChallenger(): Address {
    return this._event.parameters[4].value.toAddress();
  }

  get challengerStakeTotal(): BigInt {
    return this._event.parameters[5].value.toBigInt();
  }

  get termination(): BigInt {
    return this._event.parameters[6].value.toBigInt();
  }

  get fillId(): Bytes {
    return this._event.parameters[7].value.toBytes();
  }
}

export class ClaimStakeWithdrawn extends ethereum.Event {
  get params(): ClaimStakeWithdrawn__Params {
    return new ClaimStakeWithdrawn__Params(this);
  }
}

export class ClaimStakeWithdrawn__Params {
  _event: ClaimStakeWithdrawn;

  constructor(event: ClaimStakeWithdrawn) {
    this._event = event;
  }

  get claimId(): BigInt {
    return this._event.parameters[0].value.toBigInt();
  }

  get requestId(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get claimReceiver(): Address {
    return this._event.parameters[2].value.toAddress();
  }
}

export class DepositWithdrawn extends ethereum.Event {
  get params(): DepositWithdrawn__Params {
    return new DepositWithdrawn__Params(this);
  }
}

export class DepositWithdrawn__Params {
  _event: DepositWithdrawn;

  constructor(event: DepositWithdrawn) {
    this._event = event;
  }

  get requestId(): BigInt {
    return this._event.parameters[0].value.toBigInt();
  }

  get receiver(): Address {
    return this._event.parameters[1].value.toAddress();
  }
}

export class FinalityPeriodUpdated extends ethereum.Event {
  get params(): FinalityPeriodUpdated__Params {
    return new FinalityPeriodUpdated__Params(this);
  }
}

export class FinalityPeriodUpdated__Params {
  _event: FinalityPeriodUpdated;

  constructor(event: FinalityPeriodUpdated) {
    this._event = event;
  }

  get targetChainId(): BigInt {
    return this._event.parameters[0].value.toBigInt();
  }

  get finalityPeriod(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }
}

export class OwnershipTransferred extends ethereum.Event {
  get params(): OwnershipTransferred__Params {
    return new OwnershipTransferred__Params(this);
  }
}

export class OwnershipTransferred__Params {
  _event: OwnershipTransferred;

  constructor(event: OwnershipTransferred) {
    this._event = event;
  }

  get previousOwner(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get newOwner(): Address {
    return this._event.parameters[1].value.toAddress();
  }
}

export class RequestCreated extends ethereum.Event {
  get params(): RequestCreated__Params {
    return new RequestCreated__Params(this);
  }
}

export class RequestCreated__Params {
  _event: RequestCreated;

  constructor(event: RequestCreated) {
    this._event = event;
  }

  get requestId(): BigInt {
    return this._event.parameters[0].value.toBigInt();
  }

  get targetChainId(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get sourceTokenAddress(): Address {
    return this._event.parameters[2].value.toAddress();
  }

  get targetTokenAddress(): Address {
    return this._event.parameters[3].value.toAddress();
  }

  get targetAddress(): Address {
    return this._event.parameters[4].value.toAddress();
  }

  get amount(): BigInt {
    return this._event.parameters[5].value.toBigInt();
  }

  get validUntil(): BigInt {
    return this._event.parameters[6].value.toBigInt();
  }
}

export class RequestManager__claimsResult {
  value0: BigInt;
  value1: Address;
  value2: BigInt;
  value3: Address;
  value4: BigInt;
  value5: BigInt;
  value6: BigInt;
  value7: Bytes;

  constructor(
    value0: BigInt,
    value1: Address,
    value2: BigInt,
    value3: Address,
    value4: BigInt,
    value5: BigInt,
    value6: BigInt,
    value7: Bytes
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
    this.value4 = value4;
    this.value5 = value5;
    this.value6 = value6;
    this.value7 = value7;
  }

  toMap(): TypedMap<string, ethereum.Value> {
    let map = new TypedMap<string, ethereum.Value>();
    map.set("value0", ethereum.Value.fromUnsignedBigInt(this.value0));
    map.set("value1", ethereum.Value.fromAddress(this.value1));
    map.set("value2", ethereum.Value.fromUnsignedBigInt(this.value2));
    map.set("value3", ethereum.Value.fromAddress(this.value3));
    map.set("value4", ethereum.Value.fromUnsignedBigInt(this.value4));
    map.set("value5", ethereum.Value.fromUnsignedBigInt(this.value5));
    map.set("value6", ethereum.Value.fromUnsignedBigInt(this.value6));
    map.set("value7", ethereum.Value.fromFixedBytes(this.value7));
    return map;
  }

  getRequestId(): BigInt {
    return this.value0;
  }

  getClaimer(): Address {
    return this.value1;
  }

  getClaimerStake(): BigInt {
    return this.value2;
  }

  getLastChallenger(): Address {
    return this.value3;
  }

  getChallengerStakeTotal(): BigInt {
    return this.value4;
  }

  getWithdrawnAmount(): BigInt {
    return this.value5;
  }

  getTermination(): BigInt {
    return this.value6;
  }

  getFillId(): Bytes {
    return this.value7;
  }
}

export class RequestManager__requestsResultWithdrawInfoStruct extends ethereum.Tuple {
  get filler(): Address {
    return this[0].toAddress();
  }

  get fillId(): Bytes {
    return this[1].toBytes();
  }
}

export class RequestManager__requestsResult {
  value0: Address;
  value1: Address;
  value2: BigInt;
  value3: Address;
  value4: Address;
  value5: BigInt;
  value6: RequestManager__requestsResultWithdrawInfoStruct;
  value7: BigInt;
  value8: BigInt;
  value9: BigInt;
  value10: BigInt;

  constructor(
    value0: Address,
    value1: Address,
    value2: BigInt,
    value3: Address,
    value4: Address,
    value5: BigInt,
    value6: RequestManager__requestsResultWithdrawInfoStruct,
    value7: BigInt,
    value8: BigInt,
    value9: BigInt,
    value10: BigInt
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
    this.value4 = value4;
    this.value5 = value5;
    this.value6 = value6;
    this.value7 = value7;
    this.value8 = value8;
    this.value9 = value9;
    this.value10 = value10;
  }

  toMap(): TypedMap<string, ethereum.Value> {
    let map = new TypedMap<string, ethereum.Value>();
    map.set("value0", ethereum.Value.fromAddress(this.value0));
    map.set("value1", ethereum.Value.fromAddress(this.value1));
    map.set("value2", ethereum.Value.fromUnsignedBigInt(this.value2));
    map.set("value3", ethereum.Value.fromAddress(this.value3));
    map.set("value4", ethereum.Value.fromAddress(this.value4));
    map.set("value5", ethereum.Value.fromUnsignedBigInt(this.value5));
    map.set("value6", ethereum.Value.fromTuple(this.value6));
    map.set("value7", ethereum.Value.fromUnsignedBigInt(this.value7));
    map.set("value8", ethereum.Value.fromUnsignedBigInt(this.value8));
    map.set("value9", ethereum.Value.fromUnsignedBigInt(this.value9));
    map.set("value10", ethereum.Value.fromUnsignedBigInt(this.value10));
    return map;
  }

  getSender(): Address {
    return this.value0;
  }

  getSourceTokenAddress(): Address {
    return this.value1;
  }

  getTargetChainId(): BigInt {
    return this.value2;
  }

  getTargetTokenAddress(): Address {
    return this.value3;
  }

  getTargetAddress(): Address {
    return this.value4;
  }

  getAmount(): BigInt {
    return this.value5;
  }

  getWithdrawInfo(): RequestManager__requestsResultWithdrawInfoStruct {
    return this.value6;
  }

  getActiveClaims(): BigInt {
    return this.value7;
  }

  getValidUntil(): BigInt {
    return this.value8;
  }

  getLpFee(): BigInt {
    return this.value9;
  }

  getProtocolFee(): BigInt {
    return this.value10;
  }
}

export class RequestManager extends ethereum.SmartContract {
  static bind(address: Address): RequestManager {
    return new RequestManager("RequestManager", address);
  }

  MAX_VALIDITY_PERIOD(): BigInt {
    let result = super.call(
      "MAX_VALIDITY_PERIOD",
      "MAX_VALIDITY_PERIOD():(uint256)",
      []
    );

    return result[0].toBigInt();
  }

  try_MAX_VALIDITY_PERIOD(): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "MAX_VALIDITY_PERIOD",
      "MAX_VALIDITY_PERIOD():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  MIN_VALIDITY_PERIOD(): BigInt {
    let result = super.call(
      "MIN_VALIDITY_PERIOD",
      "MIN_VALIDITY_PERIOD():(uint256)",
      []
    );

    return result[0].toBigInt();
  }

  try_MIN_VALIDITY_PERIOD(): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "MIN_VALIDITY_PERIOD",
      "MIN_VALIDITY_PERIOD():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  challengePeriodExtension(): BigInt {
    let result = super.call(
      "challengePeriodExtension",
      "challengePeriodExtension():(uint256)",
      []
    );

    return result[0].toBigInt();
  }

  try_challengePeriodExtension(): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "challengePeriodExtension",
      "challengePeriodExtension():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  claimCounter(): BigInt {
    let result = super.call("claimCounter", "claimCounter():(uint256)", []);

    return result[0].toBigInt();
  }

  try_claimCounter(): ethereum.CallResult<BigInt> {
    let result = super.tryCall("claimCounter", "claimCounter():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  claimPeriod(): BigInt {
    let result = super.call("claimPeriod", "claimPeriod():(uint256)", []);

    return result[0].toBigInt();
  }

  try_claimPeriod(): ethereum.CallResult<BigInt> {
    let result = super.tryCall("claimPeriod", "claimPeriod():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  claimStake(): BigInt {
    let result = super.call("claimStake", "claimStake():(uint256)", []);

    return result[0].toBigInt();
  }

  try_claimStake(): ethereum.CallResult<BigInt> {
    let result = super.tryCall("claimStake", "claimStake():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  claims(param0: BigInt): RequestManager__claimsResult {
    let result = super.call(
      "claims",
      "claims(uint256):(uint256,address,uint256,address,uint256,uint256,uint256,bytes32)",
      [ethereum.Value.fromUnsignedBigInt(param0)]
    );

    return new RequestManager__claimsResult(
      result[0].toBigInt(),
      result[1].toAddress(),
      result[2].toBigInt(),
      result[3].toAddress(),
      result[4].toBigInt(),
      result[5].toBigInt(),
      result[6].toBigInt(),
      result[7].toBytes()
    );
  }

  try_claims(
    param0: BigInt
  ): ethereum.CallResult<RequestManager__claimsResult> {
    let result = super.tryCall(
      "claims",
      "claims(uint256):(uint256,address,uint256,address,uint256,uint256,uint256,bytes32)",
      [ethereum.Value.fromUnsignedBigInt(param0)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(
      new RequestManager__claimsResult(
        value[0].toBigInt(),
        value[1].toAddress(),
        value[2].toBigInt(),
        value[3].toAddress(),
        value[4].toBigInt(),
        value[5].toBigInt(),
        value[6].toBigInt(),
        value[7].toBytes()
      )
    );
  }

  collectedProtocolFees(param0: Address): BigInt {
    let result = super.call(
      "collectedProtocolFees",
      "collectedProtocolFees(address):(uint256)",
      [ethereum.Value.fromAddress(param0)]
    );

    return result[0].toBigInt();
  }

  try_collectedProtocolFees(param0: Address): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "collectedProtocolFees",
      "collectedProtocolFees(address):(uint256)",
      [ethereum.Value.fromAddress(param0)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  createRequest(
    targetChainId: BigInt,
    sourceTokenAddress: Address,
    targetTokenAddress: Address,
    targetAddress: Address,
    amount: BigInt,
    validityPeriod: BigInt
  ): BigInt {
    let result = super.call(
      "createRequest",
      "createRequest(uint256,address,address,address,uint256,uint256):(uint256)",
      [
        ethereum.Value.fromUnsignedBigInt(targetChainId),
        ethereum.Value.fromAddress(sourceTokenAddress),
        ethereum.Value.fromAddress(targetTokenAddress),
        ethereum.Value.fromAddress(targetAddress),
        ethereum.Value.fromUnsignedBigInt(amount),
        ethereum.Value.fromUnsignedBigInt(validityPeriod)
      ]
    );

    return result[0].toBigInt();
  }

  try_createRequest(
    targetChainId: BigInt,
    sourceTokenAddress: Address,
    targetTokenAddress: Address,
    targetAddress: Address,
    amount: BigInt,
    validityPeriod: BigInt
  ): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "createRequest",
      "createRequest(uint256,address,address,address,uint256,uint256):(uint256)",
      [
        ethereum.Value.fromUnsignedBigInt(targetChainId),
        ethereum.Value.fromAddress(sourceTokenAddress),
        ethereum.Value.fromAddress(targetTokenAddress),
        ethereum.Value.fromAddress(targetAddress),
        ethereum.Value.fromUnsignedBigInt(amount),
        ethereum.Value.fromUnsignedBigInt(validityPeriod)
      ]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  deprecated(): boolean {
    let result = super.call("deprecated", "deprecated():(bool)", []);

    return result[0].toBoolean();
  }

  try_deprecated(): ethereum.CallResult<boolean> {
    let result = super.tryCall("deprecated", "deprecated():(bool)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBoolean());
  }

  finalityPeriods(param0: BigInt): BigInt {
    let result = super.call(
      "finalityPeriods",
      "finalityPeriods(uint256):(uint256)",
      [ethereum.Value.fromUnsignedBigInt(param0)]
    );

    return result[0].toBigInt();
  }

  try_finalityPeriods(param0: BigInt): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "finalityPeriods",
      "finalityPeriods(uint256):(uint256)",
      [ethereum.Value.fromUnsignedBigInt(param0)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  lpFee(amount: BigInt): BigInt {
    let result = super.call("lpFee", "lpFee(uint256):(uint256)", [
      ethereum.Value.fromUnsignedBigInt(amount)
    ]);

    return result[0].toBigInt();
  }

  try_lpFee(amount: BigInt): ethereum.CallResult<BigInt> {
    let result = super.tryCall("lpFee", "lpFee(uint256):(uint256)", [
      ethereum.Value.fromUnsignedBigInt(amount)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  lpFeePPM(): BigInt {
    let result = super.call("lpFeePPM", "lpFeePPM():(uint256)", []);

    return result[0].toBigInt();
  }

  try_lpFeePPM(): ethereum.CallResult<BigInt> {
    let result = super.tryCall("lpFeePPM", "lpFeePPM():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  minLpFee(): BigInt {
    let result = super.call("minLpFee", "minLpFee():(uint256)", []);

    return result[0].toBigInt();
  }

  try_minLpFee(): ethereum.CallResult<BigInt> {
    let result = super.tryCall("minLpFee", "minLpFee():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  owner(): Address {
    let result = super.call("owner", "owner():(address)", []);

    return result[0].toAddress();
  }

  try_owner(): ethereum.CallResult<Address> {
    let result = super.tryCall("owner", "owner():(address)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  protocolFee(amount: BigInt): BigInt {
    let result = super.call("protocolFee", "protocolFee(uint256):(uint256)", [
      ethereum.Value.fromUnsignedBigInt(amount)
    ]);

    return result[0].toBigInt();
  }

  try_protocolFee(amount: BigInt): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "protocolFee",
      "protocolFee(uint256):(uint256)",
      [ethereum.Value.fromUnsignedBigInt(amount)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  protocolFeePPM(): BigInt {
    let result = super.call("protocolFeePPM", "protocolFeePPM():(uint256)", []);

    return result[0].toBigInt();
  }

  try_protocolFeePPM(): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "protocolFeePPM",
      "protocolFeePPM():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  requestCounter(): BigInt {
    let result = super.call("requestCounter", "requestCounter():(uint256)", []);

    return result[0].toBigInt();
  }

  try_requestCounter(): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "requestCounter",
      "requestCounter():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  requests(param0: BigInt): RequestManager__requestsResult {
    let result = super.call(
      "requests",
      "requests(uint256):(address,address,uint256,address,address,uint256,(address,bytes32),uint192,uint256,uint256,uint256)",
      [ethereum.Value.fromUnsignedBigInt(param0)]
    );

    return new RequestManager__requestsResult(
      result[0].toAddress(),
      result[1].toAddress(),
      result[2].toBigInt(),
      result[3].toAddress(),
      result[4].toAddress(),
      result[5].toBigInt(),
      changetype<RequestManager__requestsResultWithdrawInfoStruct>(
        result[6].toTuple()
      ),
      result[7].toBigInt(),
      result[8].toBigInt(),
      result[9].toBigInt(),
      result[10].toBigInt()
    );
  }

  try_requests(
    param0: BigInt
  ): ethereum.CallResult<RequestManager__requestsResult> {
    let result = super.tryCall(
      "requests",
      "requests(uint256):(address,address,uint256,address,address,uint256,(address,bytes32),uint192,uint256,uint256,uint256)",
      [ethereum.Value.fromUnsignedBigInt(param0)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(
      new RequestManager__requestsResult(
        value[0].toAddress(),
        value[1].toAddress(),
        value[2].toBigInt(),
        value[3].toAddress(),
        value[4].toAddress(),
        value[5].toBigInt(),
        changetype<RequestManager__requestsResultWithdrawInfoStruct>(
          value[6].toTuple()
        ),
        value[7].toBigInt(),
        value[8].toBigInt(),
        value[9].toBigInt(),
        value[10].toBigInt()
      )
    );
  }

  resolutionRegistry(): Address {
    let result = super.call(
      "resolutionRegistry",
      "resolutionRegistry():(address)",
      []
    );

    return result[0].toAddress();
  }

  try_resolutionRegistry(): ethereum.CallResult<Address> {
    let result = super.tryCall(
      "resolutionRegistry",
      "resolutionRegistry():(address)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  totalFee(amount: BigInt): BigInt {
    let result = super.call("totalFee", "totalFee(uint256):(uint256)", [
      ethereum.Value.fromUnsignedBigInt(amount)
    ]);

    return result[0].toBigInt();
  }

  try_totalFee(amount: BigInt): ethereum.CallResult<BigInt> {
    let result = super.tryCall("totalFee", "totalFee(uint256):(uint256)", [
      ethereum.Value.fromUnsignedBigInt(amount)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  transferLimit(): BigInt {
    let result = super.call("transferLimit", "transferLimit():(uint256)", []);

    return result[0].toBigInt();
  }

  try_transferLimit(): ethereum.CallResult<BigInt> {
    let result = super.tryCall(
      "transferLimit",
      "transferLimit():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  withdraw(claimId: BigInt): Address {
    let result = super.call("withdraw", "withdraw(uint256):(address)", [
      ethereum.Value.fromUnsignedBigInt(claimId)
    ]);

    return result[0].toAddress();
  }

  try_withdraw(claimId: BigInt): ethereum.CallResult<Address> {
    let result = super.tryCall("withdraw", "withdraw(uint256):(address)", [
      ethereum.Value.fromUnsignedBigInt(claimId)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }
}

export class ConstructorCall extends ethereum.Call {
  get inputs(): ConstructorCall__Inputs {
    return new ConstructorCall__Inputs(this);
  }

  get outputs(): ConstructorCall__Outputs {
    return new ConstructorCall__Outputs(this);
  }
}

export class ConstructorCall__Inputs {
  _call: ConstructorCall;

  constructor(call: ConstructorCall) {
    this._call = call;
  }

  get _claimStake(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }

  get _claimPeriod(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get _challengePeriodExtension(): BigInt {
    return this._call.inputValues[2].value.toBigInt();
  }

  get _resolutionRegistry(): Address {
    return this._call.inputValues[3].value.toAddress();
  }
}

export class ConstructorCall__Outputs {
  _call: ConstructorCall;

  constructor(call: ConstructorCall) {
    this._call = call;
  }
}

export class ChallengeClaimCall extends ethereum.Call {
  get inputs(): ChallengeClaimCall__Inputs {
    return new ChallengeClaimCall__Inputs(this);
  }

  get outputs(): ChallengeClaimCall__Outputs {
    return new ChallengeClaimCall__Outputs(this);
  }
}

export class ChallengeClaimCall__Inputs {
  _call: ChallengeClaimCall;

  constructor(call: ChallengeClaimCall) {
    this._call = call;
  }

  get claimId(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class ChallengeClaimCall__Outputs {
  _call: ChallengeClaimCall;

  constructor(call: ChallengeClaimCall) {
    this._call = call;
  }
}

export class ClaimRequestCall extends ethereum.Call {
  get inputs(): ClaimRequestCall__Inputs {
    return new ClaimRequestCall__Inputs(this);
  }

  get outputs(): ClaimRequestCall__Outputs {
    return new ClaimRequestCall__Outputs(this);
  }
}

export class ClaimRequestCall__Inputs {
  _call: ClaimRequestCall;

  constructor(call: ClaimRequestCall) {
    this._call = call;
  }

  get requestId(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }

  get fillId(): Bytes {
    return this._call.inputValues[1].value.toBytes();
  }
}

export class ClaimRequestCall__Outputs {
  _call: ClaimRequestCall;

  constructor(call: ClaimRequestCall) {
    this._call = call;
  }

  get value0(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }
}

export class CreateRequestCall extends ethereum.Call {
  get inputs(): CreateRequestCall__Inputs {
    return new CreateRequestCall__Inputs(this);
  }

  get outputs(): CreateRequestCall__Outputs {
    return new CreateRequestCall__Outputs(this);
  }
}

export class CreateRequestCall__Inputs {
  _call: CreateRequestCall;

  constructor(call: CreateRequestCall) {
    this._call = call;
  }

  get targetChainId(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }

  get sourceTokenAddress(): Address {
    return this._call.inputValues[1].value.toAddress();
  }

  get targetTokenAddress(): Address {
    return this._call.inputValues[2].value.toAddress();
  }

  get targetAddress(): Address {
    return this._call.inputValues[3].value.toAddress();
  }

  get amount(): BigInt {
    return this._call.inputValues[4].value.toBigInt();
  }

  get validityPeriod(): BigInt {
    return this._call.inputValues[5].value.toBigInt();
  }
}

export class CreateRequestCall__Outputs {
  _call: CreateRequestCall;

  constructor(call: CreateRequestCall) {
    this._call = call;
  }

  get value0(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }
}

export class DeprecateContractCall extends ethereum.Call {
  get inputs(): DeprecateContractCall__Inputs {
    return new DeprecateContractCall__Inputs(this);
  }

  get outputs(): DeprecateContractCall__Outputs {
    return new DeprecateContractCall__Outputs(this);
  }
}

export class DeprecateContractCall__Inputs {
  _call: DeprecateContractCall;

  constructor(call: DeprecateContractCall) {
    this._call = call;
  }
}

export class DeprecateContractCall__Outputs {
  _call: DeprecateContractCall;

  constructor(call: DeprecateContractCall) {
    this._call = call;
  }
}

export class RenounceOwnershipCall extends ethereum.Call {
  get inputs(): RenounceOwnershipCall__Inputs {
    return new RenounceOwnershipCall__Inputs(this);
  }

  get outputs(): RenounceOwnershipCall__Outputs {
    return new RenounceOwnershipCall__Outputs(this);
  }
}

export class RenounceOwnershipCall__Inputs {
  _call: RenounceOwnershipCall;

  constructor(call: RenounceOwnershipCall) {
    this._call = call;
  }
}

export class RenounceOwnershipCall__Outputs {
  _call: RenounceOwnershipCall;

  constructor(call: RenounceOwnershipCall) {
    this._call = call;
  }
}

export class SetFinalityPeriodCall extends ethereum.Call {
  get inputs(): SetFinalityPeriodCall__Inputs {
    return new SetFinalityPeriodCall__Inputs(this);
  }

  get outputs(): SetFinalityPeriodCall__Outputs {
    return new SetFinalityPeriodCall__Outputs(this);
  }
}

export class SetFinalityPeriodCall__Inputs {
  _call: SetFinalityPeriodCall;

  constructor(call: SetFinalityPeriodCall) {
    this._call = call;
  }

  get targetChainId(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }

  get finalityPeriod(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }
}

export class SetFinalityPeriodCall__Outputs {
  _call: SetFinalityPeriodCall;

  constructor(call: SetFinalityPeriodCall) {
    this._call = call;
  }
}

export class TransferOwnershipCall extends ethereum.Call {
  get inputs(): TransferOwnershipCall__Inputs {
    return new TransferOwnershipCall__Inputs(this);
  }

  get outputs(): TransferOwnershipCall__Outputs {
    return new TransferOwnershipCall__Outputs(this);
  }
}

export class TransferOwnershipCall__Inputs {
  _call: TransferOwnershipCall;

  constructor(call: TransferOwnershipCall) {
    this._call = call;
  }

  get newOwner(): Address {
    return this._call.inputValues[0].value.toAddress();
  }
}

export class TransferOwnershipCall__Outputs {
  _call: TransferOwnershipCall;

  constructor(call: TransferOwnershipCall) {
    this._call = call;
  }
}

export class UpdateFeeDataCall extends ethereum.Call {
  get inputs(): UpdateFeeDataCall__Inputs {
    return new UpdateFeeDataCall__Inputs(this);
  }

  get outputs(): UpdateFeeDataCall__Outputs {
    return new UpdateFeeDataCall__Outputs(this);
  }
}

export class UpdateFeeDataCall__Inputs {
  _call: UpdateFeeDataCall;

  constructor(call: UpdateFeeDataCall) {
    this._call = call;
  }

  get newProtocolFeePPM(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }

  get newLpFeePPM(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get newMinLpFee(): BigInt {
    return this._call.inputValues[2].value.toBigInt();
  }
}

export class UpdateFeeDataCall__Outputs {
  _call: UpdateFeeDataCall;

  constructor(call: UpdateFeeDataCall) {
    this._call = call;
  }
}

export class UpdateTransferLimitCall extends ethereum.Call {
  get inputs(): UpdateTransferLimitCall__Inputs {
    return new UpdateTransferLimitCall__Inputs(this);
  }

  get outputs(): UpdateTransferLimitCall__Outputs {
    return new UpdateTransferLimitCall__Outputs(this);
  }
}

export class UpdateTransferLimitCall__Inputs {
  _call: UpdateTransferLimitCall;

  constructor(call: UpdateTransferLimitCall) {
    this._call = call;
  }

  get newTransferLimit(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class UpdateTransferLimitCall__Outputs {
  _call: UpdateTransferLimitCall;

  constructor(call: UpdateTransferLimitCall) {
    this._call = call;
  }
}

export class WithdrawCall extends ethereum.Call {
  get inputs(): WithdrawCall__Inputs {
    return new WithdrawCall__Inputs(this);
  }

  get outputs(): WithdrawCall__Outputs {
    return new WithdrawCall__Outputs(this);
  }
}

export class WithdrawCall__Inputs {
  _call: WithdrawCall;

  constructor(call: WithdrawCall) {
    this._call = call;
  }

  get claimId(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class WithdrawCall__Outputs {
  _call: WithdrawCall;

  constructor(call: WithdrawCall) {
    this._call = call;
  }

  get value0(): Address {
    return this._call.outputValues[0].value.toAddress();
  }
}

export class WithdrawExpiredRequestCall extends ethereum.Call {
  get inputs(): WithdrawExpiredRequestCall__Inputs {
    return new WithdrawExpiredRequestCall__Inputs(this);
  }

  get outputs(): WithdrawExpiredRequestCall__Outputs {
    return new WithdrawExpiredRequestCall__Outputs(this);
  }
}

export class WithdrawExpiredRequestCall__Inputs {
  _call: WithdrawExpiredRequestCall;

  constructor(call: WithdrawExpiredRequestCall) {
    this._call = call;
  }

  get requestId(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class WithdrawExpiredRequestCall__Outputs {
  _call: WithdrawExpiredRequestCall;

  constructor(call: WithdrawExpiredRequestCall) {
    this._call = call;
  }
}

export class WithdrawProtocolFeesCall extends ethereum.Call {
  get inputs(): WithdrawProtocolFeesCall__Inputs {
    return new WithdrawProtocolFeesCall__Inputs(this);
  }

  get outputs(): WithdrawProtocolFeesCall__Outputs {
    return new WithdrawProtocolFeesCall__Outputs(this);
  }
}

export class WithdrawProtocolFeesCall__Inputs {
  _call: WithdrawProtocolFeesCall;

  constructor(call: WithdrawProtocolFeesCall) {
    this._call = call;
  }

  get tokenAddress(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get recipient(): Address {
    return this._call.inputValues[1].value.toAddress();
  }
}

export class WithdrawProtocolFeesCall__Outputs {
  _call: WithdrawProtocolFeesCall;

  constructor(call: WithdrawProtocolFeesCall) {
    this._call = call;
  }
}
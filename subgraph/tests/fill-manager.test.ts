import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Bytes, Address, BigInt } from "@graphprotocol/graph-ts"
import { HashInvalidated } from "../generated/schema"
import { HashInvalidated as HashInvalidatedEvent } from "../generated/FillManager/FillManager"
import { handleHashInvalidated } from "../src/mappings/fill-manager"
import { createHashInvalidatedEvent } from "./fill-manager-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let requestHash = Bytes.fromI32(1234567890)
    let fillId = Bytes.fromI32(1234567890)
    let fillHash = Bytes.fromI32(1234567890)
    let newHashInvalidatedEvent = createHashInvalidatedEvent(
      requestHash,
      fillId,
      fillHash
    )
    handleHashInvalidated(newHashInvalidatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("HashInvalidated created and stored", () => {
    assert.entityCount("HashInvalidated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "HashInvalidated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "requestHash",
      "1234567890"
    )
    assert.fieldEquals(
      "HashInvalidated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "fillId",
      "1234567890"
    )
    assert.fieldEquals(
      "HashInvalidated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "fillHash",
      "1234567890"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})

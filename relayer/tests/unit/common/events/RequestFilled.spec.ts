import { BigNumber } from "ethers";
import { Interface } from "ethers/lib/utils";

import {
  isValidRequestFilledEventData,
  parseRequestFilledEvent,
} from "@/common/events/RequestFilled";
import { generateLog } from "~/utils/data_generators";

// Return type of `decodeEventLog` is an array with both numeric & string indexes
// therefore the strange array definitions below
const VALID_EVENT_DATA = [];
VALID_EVENT_DATA["requestId"] = "1";
VALID_EVENT_DATA["fillId"] = "2";
VALID_EVENT_DATA["sourceChainId"] = BigNumber.from("1");
VALID_EVENT_DATA["targetTokenAddress"] = "0x123";
VALID_EVENT_DATA["filler"] = "0x321";
VALID_EVENT_DATA["amount"] = BigNumber.from("200");

const INVALID_EVENT_DATA = [];
INVALID_EVENT_DATA["filler"] = "0x321";
INVALID_EVENT_DATA["amount"] = BigNumber.from("200");

describe("RequestFilled", () => {
  describe("isValidRequestFilledEventData()", () => {
    it("returns true if the passed object matches a RequestFilled event data", () => {
      expect(isValidRequestFilledEventData(VALID_EVENT_DATA)).toBe(true);
    });

    it("returns false if the passed object doesn't match a RequestFilled event data", () => {
      expect(isValidRequestFilledEventData(INVALID_EVENT_DATA)).toBe(false);
    });
  });

  describe("parseRequestFilledEvent()", () => {
    it("returns null when no RequestFilled event was found inside the log set", () => {
      jest.spyOn(Interface.prototype, "decodeEventLog").mockReturnValue(INVALID_EVENT_DATA);
      const eventData = parseRequestFilledEvent([generateLog()]);

      expect(eventData).toBeNull();
    });

    it("returns the matching RequestFilled event data from the log set", () => {
      jest.spyOn(Interface.prototype, "decodeEventLog").mockReturnValue(VALID_EVENT_DATA);
      const eventData = parseRequestFilledEvent([generateLog()]);

      expect(eventData).not.toBeNull();
    });
  });
});

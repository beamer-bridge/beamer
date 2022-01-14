import collections
import os
import re
import sys
from dataclasses import dataclass, field
from typing import Sequence

_CONTRACT_PAT = re.compile(r"(\w+) <Contract>")
_FUNCTION_PAT = re.compile(r".+─ (\w+)\s+-\s+avg:\s+(\d+)")


@dataclass
class Profile:
    filename: str
    contracts: dict = field(default_factory=lambda: collections.defaultdict(dict))


def _read_profile(filename: str) -> Profile:
    contract = None
    profile = Profile(filename=filename)
    with open(filename) as fp:
        for line in fp:
            m = _CONTRACT_PAT.match(line)
            if m is not None:
                contract = m.group(1)
                continue
            m = _FUNCTION_PAT.match(line)
            if m is not None:
                function, gas = m.groups()
                profile.contracts[contract][function] = int(gas)
    return profile


def _compute_max_name_width(contracts: dict) -> int:
    """Return the maximum width needed by the function name column."""
    return max(
        len(function) for contract, functions in contracts.items() for function in functions
    )


def _compute_max_gas_width(contracts: dict, profile: Profile) -> int:
    """Return the maximum width needed by the gas column for the given profile."""
    max_gas_width = 0
    for functions in contracts.values():
        for profiles in functions.values():
            gas = profiles.get(profile.filename, 0)
            max_gas_width = max(max_gas_width, len(f"{gas:,}"))
    return max_gas_width


def _transform_profiles(profiles: Sequence[Profile]) -> dict:
    # Transform the profile data into a sequence of mappings:
    # contracts -> functions -> profiles.
    # defaultdict -> defaultdict -> dict.
    contracts: dict = collections.defaultdict(lambda: collections.defaultdict(dict))
    for profile in profiles:
        for contract, functions in profile.contracts.items():
            for function, gas in functions.items():
                contracts[contract][function][profile.filename] = gas
    return contracts


_PREFIX_TERMINAL = "   └─"
_PREFIX_NONTERMINAL = "   ├─"


def _print_profiles(contracts: dict, profiles: Sequence[Profile]) -> None:
    # Print header.
    max_name_width = _compute_max_name_width(contracts)
    fmt = "{prefix} {function:<{width}} - avg: "
    dummy = fmt.format(prefix=_PREFIX_TERMINAL, function="-", width=max_name_width)
    print(" " * len(dummy), end="")
    for profile in profiles:
        max_gas_width = _compute_max_gas_width(contracts, profile)
        print("{0:>{width}}".format(profile.filename, width=max_gas_width), end=" │ ")
    print("{0:>{width}}".format("difference", width=max_gas_width), end=" │ ")
    print()

    # Print gas values.
    for contract, functions in contracts.items():
        print(contract)
        items = tuple(functions.items())
        for idx, (function, func_profiles) in enumerate(items):
            prefix = _PREFIX_TERMINAL if idx == len(items) - 1 else _PREFIX_NONTERMINAL
            print(fmt.format(prefix=prefix, function=function, width=max_name_width), end="")
            for profile in profiles:
                max_gas_width = _compute_max_gas_width(contracts, profile)
                gas = func_profiles.get(profile.filename)
                if gas is not None:
                    print("  {0:>{width},}  ".format(gas, width=max_gas_width), end="")
                else:
                    print("  {0:>{width}}  ".format("-", width=max_gas_width), end="")

            # Print the difference.
            gas_old = func_profiles.get(profiles[0].filename)
            gas_new = func_profiles.get(profiles[1].filename)
            if gas_old is None and gas_new is None:
                diff = "-"
            elif gas_old is None and gas_new is not None:
                diff = "{0:+,}".format(gas_new)
            elif gas_old is not None and gas_new is None:
                diff = "{0:+,}".format(gas_old)
            elif gas_old is not None and gas_new is not None:
                gas_diff = gas_new - gas_old
                diff = "{0:+,}".format(gas_diff) if gas_diff != 0 else "0"
            print("  {0:>{width}}  ".format(diff, width=max_gas_width), end="")
            print()


if len(sys.argv) < 3:
    print("Usage:\n\t %s <profile1> <profile2>" % os.path.basename(sys.argv[0]))
    sys.exit(1)

profiles = _read_profile(sys.argv[1]), _read_profile(sys.argv[2])
contracts = _transform_profiles(profiles)
_print_profiles(contracts, profiles)

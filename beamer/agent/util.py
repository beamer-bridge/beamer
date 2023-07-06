from dataclasses import dataclass
from typing import cast

from eth_utils import is_checksum_address, to_checksum_address
from web3 import HTTPProvider, Web3
from web3.contract import Contract

from beamer.typing import URL, ChainId, ChecksumAddress

_Token = tuple[ChainId, ChecksumAddress]


@dataclass
class BaseChain:
    w3: Web3
    id: ChainId

    @property
    def rpc_url(self) -> URL:
        provider = cast(HTTPProvider, self.w3.provider)
        assert provider.endpoint_uri is not None
        return URL(provider.endpoint_uri)


@dataclass
class Chain(BaseChain):
    name: str
    tokens: list[tuple[ChainId, ChecksumAddress]]
    request_manager: Contract
    fill_manager: Contract


@dataclass(frozen=True)
class _TokenData:
    equivalence_class: frozenset[_Token]
    allowance: None | int


class TokenChecker:
    def __init__(self, tokens: list[list[list[str]]]) -> None:
        # A mapping of tokens to equivalence classes. Each frozenset contains
        # tokens that are considered mutually equivalent.
        self._tokens: dict[_Token, _TokenData] = {}
        for token_mapping in tokens:
            equiv_class = frozenset(
                (ChainId(int(token[0])), to_checksum_address(token[1])) for token in token_mapping
            )

            for token in token_mapping:
                chain_id = ChainId(int(token[0]))
                token_address = to_checksum_address(token[1])
                match token:
                    case [_, _]:
                        allowance = None
                    case [_, _, "-1"]:
                        allowance = 2**256 - 1
                    case [_, _, _allowance]:
                        allowance = int(_allowance)
                    case _:
                        raise ValueError("unexpected token data: %r" % token)

                assert is_checksum_address(token[1])
                self._tokens[(chain_id, token_address)] = _TokenData(equiv_class, allowance)

    def is_valid_pair(
        self,
        source_chain_id: ChainId,
        source_token_address: ChecksumAddress,
        target_chain_id: ChainId,
        target_token_address: ChecksumAddress,
    ) -> bool:
        source_token = source_chain_id, source_token_address
        target_token = target_chain_id, target_token_address
        source_token_data = self._tokens.get(source_token)
        return (
            source_token_data is not None and target_token in source_token_data.equivalence_class
        )

    def allowance(self, chain_id: ChainId, token_address: ChecksumAddress) -> None | int:
        token_data = self._tokens.get((chain_id, token_address))
        return token_data.allowance if token_data is not None else None

    def get_tokens_for_chain(self, chain_id: ChainId) -> list:
        return [token for token in self._tokens if token[0] == chain_id]

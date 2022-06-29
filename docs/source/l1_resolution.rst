L1 resolution
=============

For a working L1 resolution we need to transmit data about the filler of a given
request. In general rollups provide mechanisms for data exchange which are often
used to implement their own L1/L2 bridges. Optimism has some documentation `here
<https://community.optimism.io/docs/developers/bridge/messaging/>`_.

Given the possibility to transmit information, there are two problems that need
to be solved: how to route the information to the correct source rollup and how
to make this information trustworthy.

Routing
-------

The proof of request fulfillment will always be written by the ``FillManager``
contract on the target rollup and, in case a L1 resolution is triggered, must be
submitted to the ``ResolutionRegistry`` contract on the source rollup.

This process is started by the liquidity provider who fills an request. This
writes a proof on that rollup. This proof includes information about the
filler, the chain id of the source rollup and the request id. The proof is
basically an encoded transaction to the resolver, which can be executed
on L1.

The central role for routing this information correctly has the ``Resolver``
contract, which is deployed on the shared L1 chain of both rollups. The resolver
holds a mapping of chain ids to the contract address of the ``ResolutionRegistry``
on that chain.

When a proof transaction sent by the target rollup is executed, the resolver can
find the correct registry in the mapping and forward the information about the
filler. This again happens in form of an transaction, that can be executed on the
source rollup.

Trust
-----

To make sure that the resolved information is correct, only trusted contracts
must be allowed to take part in the message forwarding scheme. Otherwise bad
actors could freely write invalid proofs on the target rollup or even on the L1
chain.

Avoiding this requires whitelisting valid senders in all contracts on the path
of information.

* On the target rollup, the ``ProofSubmitter`` must only be callable by the ``FillManager`` contract.
* On L1, the resolver must only accept messages send by a whitelisted proof submitter for the given chain id.
* On the source rollup the registry must only accept transactions that have been sent by the L1 resolver.

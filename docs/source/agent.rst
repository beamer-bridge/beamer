Beamer agent
============


Basic requirements
------------------

* The agent must not block in any way. That is, it must not happen that the agent is stuck endlessly
  waiting on any operation, regardless of reasons. Typical common issues here are a slow RPC server
  and a slow/unstable network.
* It must be possible to shut down the agent cleanly and reasonably quickly (at most few seconds).
* Restarting the agent must not lose any information about previously executed actions e.g. filed
  requests, claims, challenges etc.
* The agent should avoid serializing anything to non-volatile storage.


Agent architecture
------------------

.. figure:: images/beamer-agent-architecture.png

   Beamer agent architecture

In order to satisfy above requirements, we opted for a simple thread-based approach where we moved
all software components that could potentially block into their own threads. In particular, these
are ``ContractEventMonitor`` and ``EventProcessor``.


ContractEventMonitor
--------------------

``ContractEventMonitor`` listens for blockchain events emitted by a given contract, decodes the events
into an internal event representation (event types in ``beamer.events``) and forwards decoded events
to the ``EventProcessor``. The event monitor does not query the JSON-RPC server for events directly.
Rather, it does that via an instance of ``EventFetcher``. Event fetcher handles communication with the
JSON-RPC server and can block. However, even if the event fetcher for, say, L2a chain, blocks, since
it is only being invoked by the contract event monitor, which runs inside a thread, it won't block
the entire agent. Therefore, even if a JSON-RPC server is very slow or the connection is otherwise
unreliable, the agent as a whole will remain responsive.

With the current contract implementation, we have one contract, ``RequestManager``, deployed on the
source chain (L2a), and one contract, ``FillManager``, deployed on the target chain (L2b). Therefore
we have two event monitors, one for each contract, and each event monitor has its own event fetcher,
as can be seen in the figure above.  Each pair ``(EventFetcher, ContractEventMonitor)`` works
independently of the other, allowing for very different speeds between the L2 chains.


EventProcessor
--------------

``EventProcessor`` implements the Beamer protocol logic. It receives events from event monitors and
stores them into a list. It is important to note that events are not separated based on the chain
they came from -- all events are stored in a single list, in the order they arrived, regardless of
the originating chain.

.. note::

  Each event object, an instance of an event type from ``beamer.events``, has a
  ``chain_id`` attribute that can be used to identify the chain that event came from.

The thread of ``EventProcessor`` will typically sleep until something interesting happens. Delivery of
fresh events by one or both of the contract event monitors is just such a case, which triggers two
actions, in order:

1. processing events
2. processing requests

The first part, processing events, consists of going through the list of all events and trying to
create new requests or modify the state of the corresponding requests. That process may not always
succeed for every event. Consider, for example, the case where a ``RequestFilled`` event was received
from L2b, but the corresponding ``RequestCreated`` event had not been seen yet. In that case, the
``RequestFilled`` event will simply be left as-is and will be retained in the event list. All events
that have been successfully handled will be dropped from the event list.

Successfully handling an event typically means modifying the state of the ``Request`` instance
corresponding to the event. To that end, ``EventProcessor`` makes use of ``RequestTracker`` facilities
to keep track of, and access all requests. The request state is, unsurprisingly, kept on the
``Request`` object itself.

The second part, processing requests, consists of going through all requests and checking whether
there is an action that needs to be performed. For example, if a pending request is encountered, the
event processor may issue a ``fillRequest`` transaction. Similarly, if a filled request is encountered
and it was our agent that filled it, the event processor may issue a ``claimRequest`` transaction. Here
again the request tracker is used to access the requests.


Request
-------

The ``Request`` object holds the information about a submitted request and the associated state.
The state machine is depicted by the following figure.

.. graphviz:: request_state_machine.dot
   :align: center
   :caption: Request state machine

The state machine uses the `python-statemachine`_ Python package to declare states and transitions.
Auto-generated transition methods like ``fill`` or ``withdraw`` are then used by the event process to
update request state. This approach also ensures that only valid transitions are possible.

.. _python-statemachine: https://python-statemachine.readthedocs.io/en/latest/readme.html

Request states mostly correspond to contract events, except for ``pending`` and `
states.  A request is in the initial state ``pending`` immediately after it is created. The ``filled``state is
transitioned to either if the agent sent a fill transaction or a ``RequestFilled`` event is received. If in
``filled`` state the ``RequestFilled`` event will update internal attributes of the request.
The process goes similarly for ``withdrawn`` state, i.e. it is entered when the corresponding blockchain
events are processed.

Claims are held in the ``ClaimTracker`` object. They will be handled separately.

The only states which will not produce an output in form of a transaction are ``ignored``, ``claimed``
and ``withdrawn``.


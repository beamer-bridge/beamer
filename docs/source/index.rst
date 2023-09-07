===========================
Beamer Bridge documentation
===========================

Welcome! This is the official documentation for Beamer Bridge.

Beamer is a bridging protocol lets you transfer your ERC20 tokens between supported L2 chains and 
it also supports bridging to L1.

Why Beamer?
-----------

* *Secure*: We don't use any liquidity pool or smart contract to deposit the liquidity. This effectively reduces to get hacked.
* *Seamless*: Our `app <https://app.beamerbridge.com/>`_ is user-friendly and easy to use. 
* *Fast*: Transfers are the fastest. You can check our speed comparison `here <https://twitter.com/BeamerBridge/status/1603043379331620865?s=20>`_.

The Beamer Protocol
-------------------

Beamer is a protocol enables users to move tokens from one chain to another. The user requests a transfer by
providing tokens on the source chain. Liquidity providers then fill the request and directly send tokens to the user
on the target chain. Check out :ref:`protocol` to learn more.

Beamer Contracts
----------------

At the core of Beamer is a set of smart contracts, written in Solidity,
that deal with transfer requests, fulfillments and messaging
between layers of Ethereum. Sections below describe each of those aspects in detail.

1. :ref:`contracts-architecture`

2. :ref:`contracts-parameters`

3. :ref:`contracts-l1-resolution`

4. :ref:`reference-contract-parameters`

Running an agent
----------------

In order to provide liquidity to the Beamer bridge, liquidity providers run one or more
instances of agent software. While everyone is welcome to write their own agent and
participate in the protocol, writing an agent is not a straightforward task. To address that,
the Beamer bridge project provides a reference agent implementation that can be used to
quickly set up liquidity provisioning. For more details on that, please check out sections below.

1. :ref:`running-agent-prerequisites`

2. :ref:`running-agent-configuration`

3. :ref:`running-agent-deployment-info`

4. :ref:`running-agent-starting`

5. :ref:`running-agent-stopping`

6. :ref:`running-agent-troubleshooting`

Development
-----------

Developers who want to contribute to the protocol can check sections below.

1. :ref:`development-overview`

2. :ref:`development-getting-started`

3. :ref:`development-agent`

4. :ref:`development-release`

5. :ref:`development-branching`

Reference documentation
-----------------------

Below you can find reference documentation on various commands, agent configuration and smart contracts.

1. :ref:`reference-commandline`

2. :ref:`reference-configuration`

3. :ref:`reference-contract-parameters`

Current Deployment
------------------

This page consists of current contract deployment addresses. :ref:`deployment`

Audits
------

You can check contract audit reports in this page. :ref:`audit`

FAQ
---

You can see the answers for questions in this page. :ref:`faq`

Glossary
--------

This page has explanations of terms used. :ref:`glossary`


Community links
---------------

Check our social media accounts and discord.

:icon:`fa-brands fa-twitter` `X <https://x.com/BeamerBridge>`_

:icon:`fa-brands fa-discord` `Discord <https://discord.gg/beamerbridge>`_

:icon:`fa-brands fa-medium` `Medium <https://medium.com/@BeamerBridge>`_

:icon:`fa-brands fa-github` `Github <https://github.com/beamer-bridge/beamer>`_


.. toctree::
   :numbered:
   :hidden:

   protocol.rst
   contracts.rst
   running-agent.rst
   development.rst
   reference.rst
   deployment.rst
   audit.rst
   faq.rst
   glossary.rst

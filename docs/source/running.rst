Running an agent
================

There are two ways to run a Beamer agent: via a container image and directly from source.


Running an agent container
--------------------------

To run an agent container simply do::

    docker run ghcr.io/beamer-bridge/beamer-agent


Running directly from source
----------------------------

First clone the Beamer repository::
    
    git clone https://github.com/beamer-bridge/beamer.git

Make sure you have Python 3.9.x and
`Poetry <https://python-poetry.org/>`_ installed.

Enter the virtual environment::

    cd beamer
    poetry shell

and install ``beamer-agent``::

    poetry install

While still inside the virtual environment, run::

    beamer-agent

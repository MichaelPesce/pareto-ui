Getting Started
===============

.. _PARETO UI Installation:

Installation
------------

To install the PARETO UI, follow the set of instructions below that are appropriate for your needs. 

Developer Role
^^^^^^^^^^^^^^

The installation instructions may vary slightly depending on the role you will have with Project Pareto.
Below are the roles we've identified:

**Users**: Use the PARETO UI to run optimizations on your data.

**Developers**: Contribute to the code base and/or run optimizations with custom code.

+------------------+------------------------------+
| Developer Role   | Installation Section         |
+==================+==============================+
| Users            | :ref:`min_install_users`     |
+------------------+------------------------------+
| Developers       | :ref:`min_install_developers`|
+------------------+------------------------------+


.. _min_install_users:

Users
-----

Follow the steps in our :ref:`how-to-use-ui-page`

.. _min_install_developers:

Developers
----------

**Prerequisites**

- Miniconda
- npm

1. Fork the repo on GitHub (your copy of the main repo)

2. Clone your fork locally, with only one of the following commands, creating a
   workspace (replacing ``<githubid>`` with your github user id)::

    git clone https://github.com/<githubid>/pareto-ui
    git clone git@github.com:<githubid>/pareto-ui

3. Create a dedicated Conda environment for development work::

    conda env create --file environment.yml

4. Activate the ``pareto-ui-env`` Conda environment. This command must be run every time a new console/terminal window is opened::

    conda activate pareto-ui-env

5. Navigate into the new ``pareto-ui/electron`` directory, then run the following command to install 
   the electron javascript dependencies::

    npm clean-install

6. Navigate into the new ``pareto-ui/electron/ui`` directory, then run the following command to install 
   the frontend dependencies::

    npm clean-install

7. Install the open-source solvers provided by the IDAES project::

    idaes get-extensions --verbose


Running the UI
--------------

1. Navigate into the new ``pareto-ui/electron`` directory, then run the following command::

    npm run electron-start
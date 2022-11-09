The branching strategy
----------------------

Here are some guidelines on our usage of branches.

**Create a new N.x branch whenever a new mainnet deployment is made.**
Such a branch is called a *deployment branch*. This clearly separates different
mainnet deployments and makes it easier to test agent and the frontend for a
particular deployment. The new branch number N is always 1 greater than the
number of the most recently created deployment branch.

**The most recent deployment branch follows the main branch until someone
decides to diverge from main.**
This can be done as easily as::

    git push origin main:N.x

Note that this must result in a fast-forward of the ``N.x`` branch.

**After a deployment branch diverges from main, further changes to the deployment branch
require PRs to be made.**
This is to ensure proper consideration and code review of the changes. In most cases it is
expected to have commits from ``main`` cherry-picked to ``N.x``.

**Try to diverge from main as late as possible.**
Due to the above, once a deployment branch diverges from ``main``, it can become annoying
to file PRs for even the smallest of changes. To lessen the pain, we should try to avoid
needlessly diverging from ``main``.

**Strive to do the changes on main first, then port to the deployment branch.**
The ``main`` branch should be the first landing spot for changes, however, in cases
where this is not possible or makes things harder, feel free to do it the other way
around.

**Agent releases are always made from a deployment branch.**
This is due to the fact that a particular agent releases assumes a particular deployment.
Also, agent releases are numbered in line with the deployment branch name.

**Any contract changes commited to the main branch cause the current deployment branch
to diverge from main.**
At this point, the deployment branch stops following ``main`` and PRs are required.

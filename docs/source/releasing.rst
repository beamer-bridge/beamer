.. _branching_strategy:

Making a new agent release
----------------------------------

#. Make sure to populate ``CHANGELOG.md`` and change the version number
   (see `this commit <https://github.com/beamer-bridge/beamer/commit/440b7ddffc01d16482d78ff9f18a8830670795bc>`_ for example).
#. Commit the changes above, create and merge the PR.
#. Take note of the commit ID on the release branch (either ``main`` or one of the ``N.x`` branches,
   depending on where you are releasing from). Tag that commit (e.g. ``git tag v0.1.8 COMMIT_ID``) and
   push the tag to Github (e.g. ``git push origin tag v0.1.8``).

    .. note:: The ID of the last commit on the release branch may be different from the ID of
              the last commit on the PR branch, even in cases where those commits have identical changes.
              Make sure to tag the commit on the release branch, not on the PR branch.

#. Once the tag is pushed, manually trigger a new CI run on the branch containing the tagged commit,
   to ensure that the built container image is tagged properly.
#. The previous step will have created an agent Docker image, which you can use for final testing before the release.
   If you encounter any release-blocking issues, fix them and restart the release process.
#. Make a release on Github based on the pushed tag.
   Copy the relevant ``CHANGELOG.md`` part to the release notes;
   see `this page <https://github.com/beamer-bridge/beamer/releases/tag/v0.1.8>`_ for example.

Making a new deployment npm package release
-------------------------------------------

The *@beamer-bridge/deployments* package is a npm package that contains the
deployment ABIs and addresses.
It also contains a *git-commit-version.txt* file that contains the commit hash
of the commit that was used to create the package.

There are 2 different release pipelines for this package.

---------
Automatic
---------
Whenever a PR changes something inside the deployments folder, a new dev release
is created on the CI server and pushed to npm.

------
Manual
------
Whenever we want or need to pin a new major version of the deployments ABIs and
addresses, we need to manually update the *package.json* version and create a PR.
Once the PR is merged into main, a new release with the specified version number
is created on CI server and pushed to npm.

On manual release we need to make sure that the package version we specify is
higher than the current version on npm.Failure to do this will result in a failed
npm release.

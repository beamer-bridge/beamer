.. _branching_strategy:

Making a new release
--------------------

#. Make sure to populate ``CHANGELOG.md`` and change the version number
   (see `this commit <https://github.com/beamer-bridge/beamer/commit/440b7ddffc01d16482d78ff9f18a8830670795bc>`_ for example).
#. Commit the changes above, create and merge the PR
   (if releasing from ``main``; there should be no PR for releases from other branches).
#. Tag the resulting commit on ``main`` or on the release branch (e.g. ``git tag v0.1.8``) and
   push it to Github (e.g. ``git push origin tag v0.1.8``).
#. Make sure a CI run is triggered, either automatically or manually, and wait for the run to finish.
#. The previous step will have created an agent Docker image, which you can use for final testing before the release.
   If you encounter any release-blocking issues, fix them and restart the release process.
#. Make a release on Github based on the pushed tag.
   Copy the relevant ``CHANGELOG.md`` part to the release notes;
   see `this page <https://github.com/beamer-bridge/beamer/releases/tag/v0.1.8>`_ for example.

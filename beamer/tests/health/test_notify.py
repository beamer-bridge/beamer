from beamer.health.notify import NotificationState


def test_value_is_set(tmpdir):
    state = NotificationState(tmpdir)

    state.update("a", "RequestExpired")

    assert state.is_set("a", "RequestExpired")
    assert not state.is_set("b", "RequestExpired")


def test_value_is_set_on_already_existing_breadcrumb(tmpdir):
    state = NotificationState(tmpdir)

    state.update("a", "RequestExpired")
    state.update("a", "UnclaimedFill")

    assert state.is_set("a", "RequestExpired")
    assert state.is_set("a", "UnclaimedFill")


def test_persist(tmpdir):
    state = NotificationState(tmpdir)

    state.update("a", "RequestExpired")

    state.persist()

    persisted = NotificationState(tmpdir)

    assert persisted.is_set("a", "RequestExpired")

from beamer.health.notify import NotificationState


def test_value_is_set():
    state = NotificationState()

    state.update("a", "RequestExpired")

    assert state.is_set("a", "RequestExpired")
    assert not state.is_set("b", "RequestExpired")


def test_value_is_set_on_already_existing_breadcrumb():
    state = NotificationState()

    state.update("a", "RequestExpired")
    state.update("a", "UnclaimedFill")

    assert state.is_set("a", "RequestExpired")
    assert state.is_set("a", "UnclaimedFill")


def test_persist():
    state = NotificationState()
    state.update("a", "RequestExpired")
    state.persist()

    persisted = NotificationState()
    assert persisted.is_set("a", "RequestExpired")

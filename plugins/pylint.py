from typing import TYPE_CHECKING

from astroid import MANAGER, Call

if TYPE_CHECKING:
    from pylint.lint import PyLinter

print("plugin loaded")

def register(linter: "PyLinter") -> None:
    """This required method auto registers the checker during initialization.

    :param linter: The linter to register the checker to.
    """
    print('register')

def transform(node):
    print('transform ran')

MANAGER.register_transform(Call, transform)
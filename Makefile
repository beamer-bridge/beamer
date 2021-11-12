CODE_DIRS = contracts/ raisync/ scripts/

all: lint

lint:
	black --check --diff $(CODE_DIRS)
	flake8 $(CODE_DIRS)
	isort $(CODE_DIRS) --diff --check-only
	mypy $(CODE_DIRS)
	pylint $(CODE_DIRS)

black:
	black $(CODE_DIRS)

format: black
	isort $(CODE_DIRS)

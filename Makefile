CODE_DIRS = contracts/ raisync/
ISORT_PARAMS = --ignore-whitespace $(CODE_DIRS)

all: lint

lint:
	black --check --diff $(CODE_DIRS)
	flake8 $(CODE_DIRS)
	isort $(ISORT_PARAMS) --diff --check-only
	pylint $(CODE_DIRS)

black:
	black $(CODE_DIRS)

format: black
	isort $(ISORT_PARAMS)

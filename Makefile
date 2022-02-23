.PHONY: dist-exe container-image

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

dist-exe:
	shiv -c raisync -o dist/raisync .

container-image:
	docker image build -f docker/Dockerfile.raisync -t raisync .

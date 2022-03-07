.PHONY: dist-exe container-image all lint black format docs clean

CODE_DIRS = contracts/ beamer/ scripts/

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
	shiv -c beamer-agent -o dist/beamer-agent .

container-image:
	docker image build -f docker/Dockerfile.agent -t beamer-agent .

docs:
	make -C docs html

clean:
	make -C docs clean

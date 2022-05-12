.PHONY: dist-exe container-image all lint black format docs clean

CODE_DIRS = beamer/ scripts/
CONTRACTS = "contracts/**/*.sol"

all: lint

lint:
	mypy $(CODE_DIRS)
	black --check --diff $(CODE_DIRS)
	flake8 $(CODE_DIRS)
	isort $(CODE_DIRS) --diff --check-only
	pylint $(CODE_DIRS)
	npx prettier --list-different $(CONTRACTS)

black:
	black $(CODE_DIRS)

format: black
	isort $(CODE_DIRS)
	npx prettier --write $(CONTRACTS)

dist-exe:
	shiv -c beamer-agent -o dist/beamer-agent .

container-image:
	docker image build -f docker/Dockerfile.agent -t beamer-agent .

docs:
	make -C docs html

clean:
	make -C docs clean

.PHONY: dist-exe container-image relayers all lint black format docs clean

CODE_DIRS = beamer/ scripts/
CONTRACTS = "contracts/**/*.sol"
IMAGE_NAME := beamer-agent

all: lint

lint:
	mypy $(CODE_DIRS)
	black --check --diff $(CODE_DIRS)
	flake8 $(CODE_DIRS)
	isort $(CODE_DIRS) --diff --check-only
	pylint $(CODE_DIRS)
	npx solhint $(CONTRACTS)
	npx prettier --list-different $(CONTRACTS)

black:
	black $(CODE_DIRS)

format: black
	isort $(CODE_DIRS)
	npx prettier --write $(CONTRACTS)

dist-exe:
	shiv -c beamer-agent -o dist/beamer-agent .

container-image: relayers
	DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.agent \
								   -t $(IMAGE_NAME):$(shell git describe --tags) \
								   -t $(IMAGE_NAME):sha-$(shell git rev-parse HEAD) .

relayers:
	yarn --cwd relayer install
	yarn --cwd relayer build
	yarn --cwd relayer add pkg
	yarn --cwd relayer run pkg -t node18-linux-x64 -o relayer-node18-linux-x64 build/src/service.js
	yarn --cwd relayer run pkg -t node18-macos-x64 -o relayer-node18-macos-x64 build/src/service.js
	mkdir -p beamer/data/relayers
	cp relayer/relayer-*-x64 beamer/data/relayers

docs:
	make -C docs html

clean:
	make -C docs clean

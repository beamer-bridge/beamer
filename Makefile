.PHONY: dist-exe container-image relayers all lint black format docs clean

CODE_DIRS = beamer/ scripts/
CONTRACTS = "contracts/**/*.sol"
IMAGE_NAME := beamer

all: lint

lint:
	mypy $(CODE_DIRS)
	black --check --diff $(CODE_DIRS)
	flake8 $(CODE_DIRS)
	isort $(CODE_DIRS) --diff --check-only
	pylint $(CODE_DIRS)
	ruff $(CODE_DIRS)
	npx solhint $(CONTRACTS)
	npx prettier --list-different $(CONTRACTS)

black:
	black $(CODE_DIRS)

format: black
	isort $(CODE_DIRS)
	npx prettier --write $(CONTRACTS)

dist-exe:
	mkdir -p dist
	# Since shiv only knows about pyproject.toml and not about poetry.lock,
	# make sure to fail if poetry.lock is not consistent with pyproject.toml.
	poetry lock --check
	shiv -c beamer -o dist/beamer .

container-image: relayers
	DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.agent \
								   -t $(IMAGE_NAME):$(shell git describe --tags) \
								   -t $(IMAGE_NAME):sha-$(shell git rev-parse HEAD) .

relayers:
	yarn --cwd relayer install
	yarn --cwd relayer build
	yarn --cwd relayer run pkg -t node18-linux-x64 -o relayer-node18-linux-x64 build/src/service.js
	yarn --cwd relayer run pkg -t node18-macos-x64 -o relayer-node18-macos-x64 build/src/service.js
	mkdir -p beamer/data/relayers
	cp relayer/relayer-*-x64 beamer/data/relayers

docs:
	python scripts/generate-contract-addresses-doc-page.py < deployments/mainnet/deployment.json \
														   > docs/source/contracts-addresses.rst
	make -C docs html

npm-package:
	yarn --cwd deployments create-package

clean:
	make -C docs clean
	rm -f docs/source/contracts-addresses.rst
	rm -rf dist
	rm -rf contracts/.build
	rm -rf contracts/contracts/.cache
	rm -rf .pytest_cache
	rm -rf deployments/dist
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .mypy_cache -exec rm -rf {} +

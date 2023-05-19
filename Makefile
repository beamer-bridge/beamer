.PHONY: dist-exe container-image relayers all lint black format docs clean difflint pydifflint soldifflint

CODE_DIRS = beamer/ scripts/
CONTRACTS = "contracts/**/*.sol"
DIFFLINT_PY_RE = "( M|A ) (beamer/|scripts/)"
DIFFLINT_SOL_RE = "( M|A ) contracts/.*sol"
IMAGE_NAME := beamer
ARCH := $(shell uname -m)

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

difflint: pydifflint soldifflint

pydifflint:
	$(eval FILES := $(shell git status --porcelain | grep --color=never -E $(DIFFLINT_PY_RE) | awk '{print $$NF}'))
	@if [ "$(FILES)" != "" ]; then \
		mypy $(FILES) && \
		black --check --diff $(FILES) && \
		flake8 $(FILES) && \
		isort $(FILES) --diff --check-only && \
		pylint $(FILES); \
	fi

soldifflint:
	$(eval FILES := $(shell git status --porcelain | grep --color=never -E $(DIFFLINT_SOL_RE) | awk '{print $$NF}'))
	@if [ "$(FILES)" != "" ]; then \
		npx solhint $(FILES) && \
		npx prettier --list-different $(FILES); \
	fi

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
	yarn --cwd deployments-npm-package create-package

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

install:
	yarn install
	poetry install
ifeq ($(ARCH),arm64)
	$(eval ATOMICS := $(shell poetry export | grep -E 'atomics==' | awk '{print $$1}'))
	$(eval VENV := $(shell poetry run poetry env info -p))
	poetry run pip uninstall atomics -y
	poetry run pip install $(ATOMICS) --platform=universal2 --no-deps --target $(VENV)/lib/python*/site-packages
endif

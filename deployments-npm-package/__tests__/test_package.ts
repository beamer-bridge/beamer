import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs/promises';

const pathToArtifacts = `${__dirname}/../../deployments/artifacts`;
/**
 * We read the artifacts directory and get read all the json artifacts, from there we extract the contracts
 * inside of the base or chain key and return them as an array.
 *
 * @returns {Promise<{ [key: string]: string[] }>}
 */
const getContractNamesPerNetwork = async () => {
  const contractsPerNetwork: { [network: string]: Set<string> } = {};
  try {
    const networkDirectories = await fs.readdir(pathToArtifacts);

    for (const networkDirectory of networkDirectories) {
      const artifactPath = path.join(pathToArtifacts, networkDirectory);
      try {
        const stat = await fs.stat(artifactPath);
        if (stat.isDirectory() && !networkDirectory.startsWith('.')) {
          const files = await fs.readdir(artifactPath);

          for (const file of files) {
            const filePath = path.join(artifactPath, file);
            const data = await fs.readFile(filePath, 'utf8');
            const json = JSON.parse(data);

            const baseContracts = json.base ? Object.keys(json.base) : [];
            const chainContracts = json.chain ? Object.keys(json.chain) : [];

            const contracts = [...baseContracts, ...chainContracts].filter(
              (key) => key !== 'chain_id',
            );

            if (!contractsPerNetwork[networkDirectory]) {
              contractsPerNetwork[networkDirectory] = new Set(contracts);
            } else {
              contractsPerNetwork[networkDirectory] = new Set([
                ...contractsPerNetwork[networkDirectory],
                ...contracts,
              ]);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  } catch (err) {
    console.error(err);
  }

  return contractsPerNetwork;
};

describe('npm package', () => {
  const packFile = path.join(__dirname, 'beamer-bridge-deployments.tgz');
  const packageName = '@beamer-bridge/deployments';

  beforeAll(() => {
    execSync(`yarn cache clean ${packageName}`);

    execSync('yarn create-dist-folder');
    // create the npm package
    execSync(`yarn pack -f ${packFile}`);
    // install the package locally
    execSync(`yarn add ${packFile}`);
  });

  afterAll(() => {
    // clean up the generated files
    execSync(`yarn remove ${packageName}`);
    execSync(`rm ${packFile}`);
  });

  /**
   * Test that all the extracted contracts from the artifacts are actually
   * present as ABI files in the package.
   */
  test('package contains expected ABI files', async () => {
    const contractsNamesPerNetwork = await getContractNamesPerNetwork();

    Object.keys(contractsNamesPerNetwork).forEach((networkName) => {
      contractsNamesPerNetwork[networkName].forEach(async (contractName) => {
        const contractAbi = await import(
          `${packageName}/dist/abis/${networkName}/${contractName}.json`
        );
        expect(contractAbi).toBeDefined();
        expect(contractAbi.abi).toBeDefined();
      });
    });
  });

  /**
   * Test that all artifacts in the artifacts directory are copied to the package dist folder
   */
  test('test that artifacts are copied to the package', async () => {
    const networkDirectories = await fs.readdir(pathToArtifacts);

    for (const networkDirectory of networkDirectories) {
      const artifactPath = path.join(pathToArtifacts, networkDirectory);
      const stat = await fs.stat(artifactPath);
      if (stat.isDirectory() && !networkDirectory.startsWith('.')) {
        const files = await fs.readdir(artifactPath);

        for (const file of files) {
          const artifact = await import(
            `${packageName}/dist/artifacts/${networkDirectory}/${file}`
          );
          expect(artifact).toBeDefined();
        }
      }
    }
  });
});

export async function requestFaucet(chainId: number, receiverAddress: string) {
  const response = await fetch(`https://faucet.beamerbridge.com/${chainId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address: receiverAddress }),
    mode: 'cors',
  });
  return response.ok;
}

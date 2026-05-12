import { Sha256 } from "@aws-sdk/crypto-sha256-js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";

const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL;
const REGION = process.env.AWS_REGION ?? "us-west-1";

export async function requestAppSync<TVariables extends Record<string, unknown>>(
  query: string,
  variables: TVariables
) {
  if (!GRAPHQL_API_URL) {
    throw new Error("GRAPHQL_API_URL is required");
  }

  const endpoint = new URL(GRAPHQL_API_URL);
  const body = JSON.stringify({ query, variables });
  const signer = new SignatureV4({
    credentials: fromNodeProviderChain(),
    region: REGION,
    service: "appsync",
    sha256: Sha256
  });

  const request = new HttpRequest({
    method: "POST",
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    headers: {
      "content-type": "application/json",
      host: endpoint.hostname
    },
    body
  });

  const signedRequest = await signer.sign(request);
  const response = await fetch(GRAPHQL_API_URL, {
    method: signedRequest.method,
    headers: signedRequest.headers as Record<string, string>,
    body
  });

  if (!response.ok) {
    throw new Error(`AppSync request failed with status ${response.status}`);
  }

  return response.json();
}

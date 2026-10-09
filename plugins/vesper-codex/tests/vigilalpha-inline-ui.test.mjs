import test from "node:test";
import assert from "node:assert/strict";
import { formatSetupStatus, listInlineResources, normalizeAppToolResult, readInlineResource, readVisualizationResource } from "../src/vigilalpha/inline-ui.mjs";
import { credentialVerificationMessage, TOOL_DEFINITIONS } from "../src/mcp/tools.mjs";

test("all inline resources are local, responsive and contain parsable scripts", () => {
  const resources = listInlineResources();
  assert.equal(resources.length, 4);
  for (const resource of resources) {
    const content = readInlineResource(resource.uri) || readVisualizationResource(resource.uri);
    assert.ok(content, resource.uri);
    assert.doesNotMatch(content.text, /(?:src|href)=["']https?:|fetch\(["']https?:/);
    assert.match(content.text, /viewport/);
    assert.match(content.text, /prefers-reduced-motion/);
    for (const match of content.text.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => new Function(match[1]), `invalid inline script in ${resource.uri}`);
    }
  }
});

test("setup card accepts canonical and compatibility tool-result envelopes", () => {
  const configured = { configured: true, version: "0.1.0-dev.10", credentialSource: "macos-keychain" };
  assert.deepEqual(normalizeAppToolResult({ structuredContent: configured }), configured);
  assert.deepEqual(normalizeAppToolResult({ result: { structuredContent: configured } }), configured);
  assert.deepEqual(normalizeAppToolResult({ mcp_tool_result: { structuredContent: configured } }), configured);
  assert.deepEqual(normalizeAppToolResult(configured), configured);
  assert.match(formatSetupStatus(configured), /已配置/);
  assert.match(formatSetupStatus({ configured: false, version: "0.1.0-dev.10" }), /尚未检测到/);
});

test("credential verification errors identify safe corrective actions without echoing server bodies", () => {
  assert.match(credentialVerificationMessage({ status: 401, message: "secret-value" }, "demo"), /401.*Demo/);
  assert.match(credentialVerificationMessage({ status: 403 }, "live"), /403.*Invest or Stocks ISA/);
  assert.match(credentialVerificationMessage({ status: 429 }, "live"), /5 seconds/);
  assert.match(credentialVerificationMessage({ message: "timed out after 10000ms" }, "live"), /timed out/);
  assert.doesNotMatch(credentialVerificationMessage({ status: 401, message: "secret-value" }), /secret-value/);
});

test("review tools reference the intended inline resources", () => {
  const byName = new Map(TOOL_DEFINITIONS.map((definition) => [definition.name, definition]));
  assert.equal(byName.get("portfolio_review")._meta.ui.resourceUri, "ui://vigilalpha/portfolio-flow.html");
  assert.equal(byName.get("holding_review")._meta.ui.resourceUri, "ui://vigilalpha/holding-chart.html");
  assert.equal(byName.get("portfolio_changes")._meta.ui.resourceUri, "ui://vigilalpha/risk-timeline.html");
  assert.deepEqual(byName.get("configure_credentials")._meta.ui.visibility, ["app"]);
});

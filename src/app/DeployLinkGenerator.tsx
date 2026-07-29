"use client";

import { useState } from "react";
import { buildDeployUrl } from "@/lib/deploy";

const randomSecret = (bytes: number) => {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

export default function DeployLinkGenerator() {
  const [repositoryUrl, setRepositoryUrl] = useState("https://github.com/0xagentlabs/oauth-mcp-framework");
  const [projectName, setProjectName] = useState("oauth-mcp-framework");
  const [privateMode, setPrivateMode] = useState(false);
  const [configuration, setConfiguration] = useState<{ url: string; env: string }>();
  const [copied, setCopied] = useState("");

  const generate = () => {
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(repositoryUrl.trim()) || !/^[a-z0-9-]+$/.test(projectName)) return;
    const oauthSecret = randomSecret(48);
    const password = privateMode ? randomSecret(24) : "";
    setConfiguration({
      url: buildDeployUrl(repositoryUrl, projectName, privateMode),
      env: `OAUTH_SECRET=${oauthSecret}${password ? `\nMCP_AUTH_PASSWORD=${password}` : ""}`,
    });
    setCopied("");
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  };

  return (
    <section className="deploy-generator">
      <div className="guide-heading">
        <span className="guide-icon">↗</span>
        <div>
          <strong>Deploy Link 生成器</strong>
          <p>生成部署链接、随机环境变量和 Blob 绑定步骤。</p>
        </div>
      </div>
      <div className="generator-fields">
        <label>
          GitHub 仓库地址
          <input value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} />
        </label>
        <label>
          Vercel 项目名
          <input value={projectName} onChange={(event) => setProjectName(event.target.value.toLowerCase())} pattern="[a-z0-9-]+" />
        </label>
        <label className="check-field">
          <input type="checkbox" checked={privateMode} onChange={(event) => setPrivateMode(event.target.checked)} />
          同时生成私有访问密码
        </label>
      </div>
      <button className="generate-button" type="button" onClick={generate}>生成部署配置</button>

      {configuration && (
        <div className="generated-config">
          <h3>1. 环境变量</h3>
          <p>在 Vercel 导入页面填写以下值。密钥只在当前浏览器生成，不会进入 Deploy Link。</p>
          <div className="code-box"><pre>{configuration.env}</pre><button onClick={() => copy(configuration.env, "env")}>{copied === "env" ? "已复制" : "复制"}</button></div>
          <h3>2. 创建项目</h3>
          <a className="deploy-button" href={configuration.url} target="_blank" rel="noreferrer">打开 Vercel Deploy 页面 ↗</a>
          <h3>3. 连接 Blob</h3>
          <ol>
            <li>首次部署后进入 Project → <strong>Storage</strong>。</li>
            <li>选择 <strong>Create Database → Blob → Private</strong>。</li>
            <li>连接 Production、Preview 和 Development 环境。</li>
            <li>确认环境变量中出现 Blob 凭证，然后在 Deployments 中重新部署。</li>
          </ol>
          <p className="guide-warning">Vercel Deploy Link 不能自动创建 Blob Store，这一步必须在项目控制台手工完成。</p>
        </div>
      )}
    </section>
  );
}

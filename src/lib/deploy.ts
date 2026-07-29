export function buildDeployUrl(repositoryUrl: string, projectName: string, privateMode: boolean) {
  const url = new URL("https://vercel.com/new/clone");
  url.searchParams.set("repository-url", repositoryUrl.trim());
  url.searchParams.set("project-name", projectName.trim());
  url.searchParams.set("repository-name", projectName.trim());
  url.searchParams.set("env", privateMode ? "OAUTH_SECRET,MCP_AUTH_PASSWORD" : "OAUTH_SECRET");
  url.searchParams.set("envDescription", "OAuth MCP production secrets");
  return url.toString();
}

import Keycloak from "keycloak-js";

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || `${window.location.origin}/auth`;
const keycloakRealm = import.meta.env.VITE_KEYCLOAK_REALM || "twisted-vault";
const keycloakClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "twisted-vault-frontend";

export const keycloak = new Keycloak({
  url: keycloakUrl,
  realm: keycloakRealm,
  clientId: keycloakClientId,
});

let authInit: Promise<boolean> | null = null;

export async function initAuth(): Promise<string> {
  authInit ??= keycloak.init({ onLoad: "login-required", pkceMethod: "S256", checkLoginIframe: false });
  await authInit;
  if (!keycloak.token) throw new Error("Keycloak did not issue an access token");
  return keycloak.token;
}

export async function refreshToken(): Promise<string> {
  await keycloak.updateToken(60);
  if (!keycloak.token) throw new Error("Keycloak session expired");
  return keycloak.token;
}

export function logout(): void {
  void keycloak.logout({ redirectUri: window.location.origin });
}

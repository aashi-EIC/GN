import { useState } from "react";
import { MicrosoftMark } from "../../../shared/components/Brand";

export function LoginPage({
  entraAvailable,
  onEntraSignIn,
}: {
  entraAvailable: boolean;
  onEntraSignIn?: () => Promise<void>;
  onLocalSignIn?: (credentials: { username: string; name?: string }) => Promise<void>;
}) {
  const [providerError, setProviderError] = useState("");
  const [entraBusy, setEntraBusy] = useState(false);

  const signInWithEntra = async () => {
    if (!entraAvailable || !onEntraSignIn) {
      setProviderError("Entra ID sign-in needs VITE_ENTRA_CLIENT_ID and VITE_ENTRA_TENANT_ID.");
      return;
    }

    try {
      setProviderError("");
      setEntraBusy(true);
      await onEntraSignIn();
    } catch (caught) {
      setProviderError(
        caught instanceof Error ? caught.message : "Entra ID sign-in was not completed.",
      );
    } finally {
      setEntraBusy(false);
    }
  };

  return (
    <main className="login-page-container">
      <div className="login-modal-card single-login">
        {/* Header dark blue banner */}
        <header className="login-card-header">
          <div className="header-brand-wrap">
            <div className="header-text-brand">
              <span className="brand-name"><h1>Conversational BI</h1></span>
              <span className="brand-sub">a nielsen company</span>
            </div>
          </div>
          <p className="header-subtitle">
            Sign in with your Microsoft Entra ID account to access Conversational BI.
          </p>
        </header>

        <div className="login-card-body single-login-body">
          <div className="login-col social-col single-login-col">
            <h3 className="col-heading">Sign in with your organizational account</h3>

            <button
              className={`microsoft-login-btn ${entraAvailable ? "" : "needs-config"}`}
              onClick={signInWithEntra}
              disabled={entraBusy}
              type="button"
            >
              <span className="btn-icon-sq">
                <MicrosoftMark />
              </span>
              <span className="btn-label">
                {entraBusy ? "Opening Microsoft..." : "Continue with Microsoft"}
              </span>
            </button>

            <p className="col-footnote">
              Single Sign-On (SSO) is enabled via Microsoft Entra ID.
            </p>
          </div>
        </div>

        {providerError && <div className="card-error-banner">{providerError}</div>}
      </div>
    </main>
  );
}




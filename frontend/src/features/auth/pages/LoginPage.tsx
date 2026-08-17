import { useState } from "react";
import { AskBrandMark, MicrosoftMark } from "../../../shared/components/Brand";
import { ShieldCheck } from "lucide-react";

export function LoginPage({
  entraAvailable,
  onEntraSignIn,
}: {
  entraAvailable: boolean;
  onEntraSignIn?: () => Promise<void>;
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
        {/* Header banner aligned with Chatbot styling */}
        <header className="login-card-header">
          <div className="header-brand-wrap">
            <AskBrandMark />
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

            <div className="login-security-badge">
              <ShieldCheck className="security-icon" />
              <span>Enterprise Single Sign-On (SSO) via Microsoft Entra ID</span>
            </div>
          </div>
        </div>

        {providerError && <div className="card-error-banner">{providerError}</div>}
      </div>
    </main>
  );
}

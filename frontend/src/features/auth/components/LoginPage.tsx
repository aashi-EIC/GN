import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { isEntraConfigured } from "../services/msal";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export function LoginPage() {
  const { login, authError } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("entra-auth-active");
    return () => {
      document.body.classList.remove("entra-auth-active");
    };
  }, []);

  const handleSignIn = async () => {
    setLocalError(null);
    if (!isEntraConfigured()) {
      setLocalError(
        "Microsoft Entra ID is not yet configured. Please set credentials.",
      );
      return;
    }
    setIsSigningIn(true);
    try {
      await login();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to sign in with Microsoft");
      setIsSigningIn(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="entra-login-viewport">
      <div className="entra-login-card">
        <div className="entra-login-header">
          <div className="entra-login-brand-row">
            <img
              src="/gracenote-favicon.svg"
              alt="Gracenote"
              className="entra-login-logo"
            />
            <h1 className="entra-login-title">Conversational BI</h1>
          </div>
          <p className="entra-login-desc">
            Sign in with your Microsoft Entra ID account to access Conversational BI.
          </p>
        </div>

        <div className="entra-login-divider" />

        <div className="entra-login-body">
          <p className="entra-login-subtitle">
            Sign in with your organizational account
          </p>

          {displayError && (
            <div className="entra-login-alert" role="alert">
              <AlertCircle size={15} className="entra-alert-icon" />
              <span>{displayError}</span>
            </div>
          )}

          <div className="entra-login-action-wrap">
            <button
              type="button"
              className="entra-microsoft-btn"
              onClick={handleSignIn}
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="btn-spinner" size={18} />
                  <span>Connecting to Microsoft...</span>
                </>
              ) : (
                <>
                  <svg
                    className="microsoft-logo-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 21 21"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  <span className="entra-microsoft-btn-text">Continue with Microsoft</span>
                </>
              )}
            </button>
          </div>

          <div className="entra-login-sso-badge">
            <ShieldCheck size={16} className="entra-shield-icon" />
            <span className="entra-shield-text">
              Enterprise Single Sign-On (SSO) via Microsoft Entra ID
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

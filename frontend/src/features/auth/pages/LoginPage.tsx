import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MicrosoftMark } from "../../../shared/components/Brand";

const loginSchema = z.object({
  username: z.string().trim().min(4, "Enter a valid username."),
  password: z.string().trim().min(6, "Enter a password with at least 6 characters."),
  name: z.string().trim().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function maskEmail(email: string): string {
  if (!email) return "u***@d***.com";
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  if (parts.length === 2 && parts[0] && parts[1]) {
    const u = parts[0];
    const d = parts[1];
    const userMasked = u.length > 2 ? `${u.slice(0, 2)}***` : `${u[0]}***`;
    const domainMasked = d.length > 2 ? `${d.slice(0, 2)}***` : `${d[0]}***`;
    return `${userMasked}@${domainMasked}`;
  }
  return trimmed.length > 2 ? `${trimmed.slice(0, 2)}***` : "***";
}

export function LoginPage({
  entraAvailable,
  onEntraSignIn,
  onLocalSignIn,
}: {
  entraAvailable: boolean;
  onEntraSignIn?: () => Promise<void>;
  onLocalSignIn?: (credentials: { username: string; name?: string }) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
    },
  });

  const [viewMode, setViewMode] = useState<"signin" | "forgot-password" | "reset-password" | "success">("signin");
  const [providerError, setProviderError] = useState("");
  const [entraBusy, setEntraBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);

  // Forgot / Reset password state
  const [forgotUsername, setForgotUsername] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  const submitLocalForm = handleSubmit(async (values) => {
    try {
      setProviderError("");
      setLocalBusy(true);

      const response = await fetch("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username.trim(),
          password: values.password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setProviderError(data.message || "Invalid email or password.");
        return;
      }

      if (onLocalSignIn) {
        await onLocalSignIn({
          username: data.user?.email || values.username.trim(),
          name: data.user?.name || values.name?.trim(),
        });
      }
    } catch (caught) {
      setProviderError(
        caught instanceof Error ? caught.message : "Sign-in was not completed.",
      );
    } finally {
      setLocalBusy(false);
    }
  });

  const handleOpenForgot = () => {
    setProviderError("");
    const currentInput = getValues("username");
    if (currentInput) {
      setForgotUsername(currentInput.trim());
    }
    setViewMode("forgot-password");
  };

  const handleSendResetCode = (e: React.FormEvent) => {
    e.preventDefault();
    setProviderError("");
    if (!forgotUsername.trim()) {
      setProviderError("Please enter your Email / Username.");
      return;
    }
    setViewMode("reset-password");
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setProviderError("");
    if (!resetCode.trim()) {
      setProviderError("Please enter the verification code sent to your email.");
      return;
    }
    if (newPassword.length < 6) {
      setProviderError("New Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setProviderError("New Password and Confirmation do not match.");
      return;
    }

    setSuccessMessage("Your password has been changed successfully. You can now sign in with your new password.");
    setViewMode("success");
  };

  const formError =
    providerError ||
    (viewMode === "signin" ? errors.username?.message || errors.password?.message : "");

  return (
    <main className="login-page-container">
      <div className="login-modal-card">
        {/* Header dark blue banner */}
        <header className="login-card-header">
          <div className="header-brand-wrap">
            <div className="header-text-brand">
              <span className="brand-name">conversational bi</span>
              <span className="brand-sub">a nielsen company</span>
            </div>
          </div>
          <h1 className="header-title">Conversational BI</h1>
          <p className="header-subtitle">
            Conversational BI/Nielsen users, continue with Microsoft.<br />
            All others, sign in with username &amp; password.
          </p>
        </header>

        {/* View mode 1: Sign in */}
        {viewMode === "signin" && (
          <div className="login-card-body">
            {/* Left Column: Microsoft Entra ID */}
            <div className="login-col social-col">
              <h3 className="col-heading">Sign in with your social account</h3>

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
                We won't post to any of your accounts without asking first
              </p>
            </div>

            {/* Divider */}
            <div className="login-divider">
              <span className="divider-text">or</span>
            </div>

            {/* Right Column: Username & Password */}
            <div className="login-col form-col">
              <h3 className="col-heading">Sign in with your username and password</h3>

              <form onSubmit={submitLocalForm} className="credentials-form">
                <label className="form-label">
                  Username
                  <input
                    type="text"
                    placeholder="Username"
                    {...register("username")}
                    disabled={localBusy}
                    className="form-input"
                  />
                </label>

                <label className="form-label">
                  Password
                  <input
                    type="password"
                    placeholder="Password"
                    {...register("password")}
                    disabled={localBusy}
                    className="form-input"
                  />
                </label>

                <div className="forgot-pass-wrap">
                  <button
                    type="button"
                    className="forgot-pass-link"
                    onClick={handleOpenForgot}
                  >
                    Forgot your password?
                  </button>
                </div>

                <button className="submit-signin-btn" type="submit" disabled={localBusy}>
                  {localBusy ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* View mode 2: Forgot your password? (Image 1) */}
        {viewMode === "forgot-password" && (
          <div className="forgot-card-body">
            <h2 className="forgot-card-title">Forgot your password?</h2>
            <p className="forgot-card-subtext">
              Enter your Username / Email ID below and we will send a message to reset your password
            </p>

            <form onSubmit={handleSendResetCode} className="forgot-card-form">
              <input
                type="text"
                className="forgot-input"
                placeholder="Enter your Email ID"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
              />

              <button type="submit" className="forgot-action-btn">
                Reset my password
              </button>

              <div className="forgot-back-wrap">
                <button
                  type="button"
                  className="forgot-back-link"
                  onClick={() => setViewMode("signin")}
                >
                  ← Cancel and back to Sign in
                </button>
              </div>
            </form>
          </div>
        )}

        {/* View mode 3: Reset password code & new password (Image 2) */}
        {viewMode === "reset-password" && (
          <div className="forgot-card-body">
            <p className="forgot-card-subtext">
              We have sent a password reset OTP code by email to{" "}
              <strong>{maskEmail(forgotUsername)}</strong>. Enter it below to reset your password.
            </p>

            <form onSubmit={handleChangePassword} className="reset-card-form">
              <label className="reset-field-label">
                Code
                <input
                  type="text"
                  className="forgot-input"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                />
              </label>

              <label className="reset-field-label">
                New Password
                <input
                  type="password"
                  className="forgot-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>

              <label className="reset-field-label">
                Enter New Password Again
                <input
                  type="password"
                  className="forgot-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>

              <button type="submit" className="forgot-action-btn">
                Change Password
              </button>

              <div className="forgot-back-wrap">
                <button
                  type="button"
                  className="forgot-back-link"
                  onClick={() => setViewMode("forgot-password")}
                >
                  ← Back
                </button>
              </div>
            </form>
          </div>
        )}

        {/* View mode 4: Success */}
        {viewMode === "success" && (
          <div className="forgot-card-body">
            <h2 className="forgot-card-title" style={{ color: "#15803d" }}>
              Password Changed!
            </h2>
            <p className="forgot-card-subtext">{successMessage}</p>

            <button
              type="button"
              className="forgot-action-btn"
              onClick={() => {
                setViewMode("signin");
                setSuccessMessage("");
              }}
            >
              Sign in with New Password
            </button>
          </div>
        )}

        {formError && <div className="card-error-banner">{formError}</div>}
      </div>
    </main>
  );
}



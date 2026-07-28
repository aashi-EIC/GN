import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CloudBiLoginCredentials } from "../../types/app";
import { BrandMark, MicrosoftMark } from "../../components/common/Brand";

const cloudBiSchema = z.object({
  cloudBiId: z.string().trim().min(4, "Enter a valid username."),
  accessCode: z.string().trim().min(6, "Enter a password with at least 6 characters."),
  name: z.string().trim().optional(),
});

type CloudBiFormValues = z.infer<typeof cloudBiSchema>;

export function LoginPage({
  entraAvailable,
  onEntraSignIn,
  onCloudBiSignIn,
}: {
  entraAvailable: boolean;
  onEntraSignIn?: () => Promise<void>;
  onCloudBiSignIn: (credentials: CloudBiLoginCredentials) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CloudBiFormValues>({
    resolver: zodResolver(cloudBiSchema),
    defaultValues: {
      cloudBiId: "aditya@gmail.com",
      accessCode: "123456",
      name: "Aditya",
    },
  });
  const [providerError, setProviderError] = useState("");
  const [entraBusy, setEntraBusy] = useState(false);
  const [cloudBiBusy, setCloudBiBusy] = useState(false);

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

  const submitCloudBi = handleSubmit(async (values) => {
    const trimmedCloudBiId = values.cloudBiId.trim();
    const trimmedName = values.name?.trim() ?? "";

    try {
      setProviderError("");
      setCloudBiBusy(true);
      await onCloudBiSignIn({
        cloudBiId: trimmedCloudBiId,
        accessCode: values.accessCode.trim(),
        name: trimmedName || undefined,
      });
    } catch (caught) {
      setProviderError(
        caught instanceof Error ? caught.message : "Sign-in was not completed.",
      );
    } finally {
      setCloudBiBusy(false);
    }
  });

  const formError =
    providerError ||
    errors.cloudBiId?.message ||
    errors.accessCode?.message;

  return (
    <main className="login-page-container">
      <div className="login-modal-card">
        {/* Header dark blue banner */}
        <header className="login-card-header">
          <div className="header-brand-wrap">
            <div className="header-text-brand">
              <span className="brand-name">Conversational BI</span>
              <span className="brand-sub">a nielsen company</span>
            </div>
          </div>
          <h1 className="header-title">Conversational BI</h1>
          <p className="header-subtitle">
            Conversational BI/Nielsen users, continue with Microsoft.<br />
            All others, sign in with username &amp; password.
          </p>
        </header>

        {/* Body 2-column layout */}
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

            <form onSubmit={submitCloudBi} className="credentials-form">
              <label className="form-label">
                Username
                <input
                  type="text"
                  placeholder="Username"
                  {...register("cloudBiId")}
                  disabled={cloudBiBusy}
                  className="form-input"
                />
              </label>

              <label className="form-label">
                Password
                <input
                  type="password"
                  placeholder="Password"
                  {...register("accessCode")}
                  disabled={cloudBiBusy}
                  className="form-input"
                />
              </label>

              <div className="forgot-pass-wrap">
                <button
                  type="button"
                  className="forgot-pass-link"
                  onClick={() => setProviderError("Please contact your administrator to reset your password.")}
                >
                  Forgot your password?
                </button>
              </div>

              <button className="submit-signin-btn" type="submit" disabled={cloudBiBusy}>
                {cloudBiBusy ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>

        {formError && <div className="card-error-banner">{formError}</div>}
      </div>
    </main>
  );
}

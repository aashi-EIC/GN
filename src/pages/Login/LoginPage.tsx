import { zodResolver } from "@hookform/resolvers/zod";
import { Cloud, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CloudBiLoginCredentials } from "../../types/app";
import { BrandMark, MicrosoftMark } from "../../components/common/Brand";

const cloudBiSchema = z.object({
  cloudBiId: z.string().trim().min(4, "Enter a valid Cloud BI ID."),
  accessCode: z.string().trim().min(6, "Enter a Cloud BI access code with at least 6 characters."),
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
      cloudBiId: "aashi@gmail.com",
      accessCode: "123456",
      name: "Aashi",
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
        caught instanceof Error ? caught.message : "Cloud BI ID sign-in was not completed.",
      );
    } finally {
      setCloudBiBusy(false);
    }
  });

  const formError =
    providerError ||
    errors.cloudBiId?.message ||
    errors.accessCode?.message ||
    errors.name?.message;

  return (
    <main className="login">
      <section className="login-art">
        <BrandMark light />
        <div className="login-visual" aria-hidden="true">
          <div className="signal-ring one" />
          <div className="signal-ring two" />
          <div className="signal-panel panel-a">
            <span>Schedule</span>
            <strong>97.2%</strong>
            <small>Complete</small>
          </div>
          <div className="signal-panel panel-b">
            <span>Mapping</span>
            <strong>95.1%</strong>
            <small>Matched</small>
          </div>
        </div>
        <div className="login-copy">
          <span>Conversational intelligence</span>
          <h1>Ask governed data. Act on the answer.</h1>
          <p>
            Explore Gracenote semantic models for imagery, linear grading, mapping, metadata,
            program gaps, schedule completeness and BIA usage.
          </p>
        </div>
        <div className="trust">
          <ShieldCheck />
          <span>Protected by Microsoft Entra ID and Cloud BI ID</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="mobile-brand">
          <BrandMark />
        </div>
        <div className="login-card">
          <span>Welcome</span>
          <h2>Gracenote Intelligence</h2>
          <p>Choose your identity provider to open the workspace.</p>

          <div className="auth-methods">
            <button
              className={`auth-option entra-option ${entraAvailable ? "" : "needs-config"}`}
              onClick={signInWithEntra}
              disabled={entraBusy}
              type="button"
            >
              <span className="auth-icon">
                <MicrosoftMark />
              </span>
              <span>
                <b>{entraBusy ? "Opening Entra ID" : "Continue with Entra ID"}</b>
                <small>
                  {entraAvailable ? "Microsoft identity platform" : "Entra configuration required"}
                </small>
              </span>
            </button>

            <form onSubmit={submitCloudBi} className="cloud-bi-login">
              <div className="cloud-bi-title">
                <Cloud />
                <span>
                  <b>Cloud BI ID</b>
                  <small>Direct workspace identity</small>
                </span>
              </div>
              <label>
                Cloud BI ID
                <input {...register("cloudBiId")} aria-label="Cloud BI ID" disabled={cloudBiBusy} />
              </label>
              <label>
                Access code
                <input
                  type="password"
                  {...register("accessCode")}
                  aria-label="Cloud BI access code"
                  disabled={cloudBiBusy}
                />
              </label>
              <label>
                Display name
                <input {...register("name")} aria-label="Display name" disabled={cloudBiBusy} />
              </label>
              <button className="primary-action" type="submit" disabled={cloudBiBusy}>
                <KeyRound />
                <span>{cloudBiBusy ? "Opening Cloud BI" : "Continue with Cloud BI ID"}</span>
              </button>
            </form>
          </div>

          {formError && <strong className="form-error">{formError}</strong>}
        </div>
      </section>
    </main>
  );
}

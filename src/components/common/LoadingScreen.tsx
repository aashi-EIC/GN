import { BrandMark } from "./Brand";

export function LoadingScreen() {
  return (
    <main className="loading-screen">
      <BrandMark light />
      <div className="thinking">
        <i />
        <i />
        <i />
        Opening secure workspace
      </div>
    </main>
  );
}

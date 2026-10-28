import { lazy } from "react";

const loadGuide = () =>
  import("../../features/settings/components/GuideModal").then((module) => ({
    default: module.GuideModal,
  }));
const loadSettings = () =>
  import("../../features/settings/components/SettingsModal").then((module) => ({
    default: module.SettingsModal,
  }));
const loadTour = () => import("./TourModal").then((module) => ({ default: module.TourModal }));
const loadReport = () =>
  import("../../features/debug/components/ErrorReportModal").then((module) => ({
    default: module.ErrorReportModal,
  }));
const loadDebug = () =>
  import("../../features/debug/components/DebugDrawer").then((module) => ({
    default: module.DebugDrawer,
  }));

export const GuideModal = lazy(loadGuide);
export const SettingsModal = lazy(loadSettings);
export const TourModal = lazy(loadTour);
export const ErrorReportModal = lazy(loadReport);
export const DebugDrawer = lazy(loadDebug);

/** Download panel code without mounting panels or requesting their data. */
export function preloadPanels() {
  void Promise.allSettled([loadGuide(), loadSettings(), loadTour(), loadReport(), loadDebug()]);
}

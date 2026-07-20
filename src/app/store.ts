import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import { storageKeys } from "../config/storage";

type UiState = {
  sidebarOpen: boolean;
  debugOpen: boolean;
  themeMode: "light" | "dark";
};

const initialState: UiState = {
  sidebarOpen: false,
  debugOpen: false,
  themeMode:
    typeof window !== "undefined" && localStorage.getItem(storageKeys.theme) === "dark"
      ? "dark"
      : "light",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setDebugOpen(state, action: PayloadAction<boolean>) {
      state.debugOpen = action.payload;
    },
    setThemeMode(state, action: PayloadAction<UiState["themeMode"]>) {
      state.themeMode = action.payload;
    },
    toggleThemeMode(state) {
      state.themeMode = state.themeMode === "dark" ? "light" : "dark";
    },
  },
});

export const store = configureStore({
  reducer: {
    ui: uiSlice.reducer,
  },
});

export const uiActions = uiSlice.actions;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";

type UiState = {
  sidebarOpen: boolean;
  debugOpen: boolean;
};

const initialState: UiState = {
  sidebarOpen: true,
  debugOpen: false,
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
